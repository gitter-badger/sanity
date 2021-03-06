// @flow

import {Patcher} from '../patch'
import luid from './luid'

// A mutation describing a number of operations on a single document
// This should be considered an immutable structure. Mutations are compiled
// on first application, and any changes in properties will not effectively
// change its behavior after that.
export default class Mutation {
  params : {
    transactionId : string,
    transition : string,
    identity : string,
    previousRev : string,
    resultRev : string,
    mutations : Array<Object>,
    timestamp: String,
  }
  compiled : Function
  constructor(options : Object) {
    this.params = options
  }

  get transactionId() : string {
    return this.params.transactionId
  }
  get transition() : string {
    return this.params.transition
  }
  get identity() : string {
    return this.params.identity
  }
  get previousRev() : string {
    return this.params.previousRev
  }
  get resultRev() : string {
    return this.params.resultRev
  }
  get mutations() : Array<Object> {
    return this.params.mutations
  }
  get timestamp() : Date {
    if (typeof this.params.timestamp == 'string') {
      return new Date(this.params.timestamp)
    }
    return undefined
  }
  assignRandomTransactionId() {
    this.params.resultRev = this.params.transactionId = luid()
  }
  appliesToMissingDocument() {
    if (typeof this._appliesToMissingDocument != 'undefined') {
      return this._appliesToMissingDocument
    }
    // Only mutations starting with a create operation apply to documents that do not exist ...
    const firstMut = this.mutations[0]
    if (firstMut) {
      this._appliesToMissingDocument = (firstMut.create || firstMut.createIfNotExist || firstMut.createOrReplace)
    } else {
      this._appliesToMissingDocument = true
    }
    return this._appliesToMissingDocument
  }
  // Compiles all mutations into a handy function
  compile() {
    const operations = []
    this.mutations.forEach(mutation => {
      if (mutation.create) {
        operations.push(doc => (doc === null ? mutation.create : doc))
      } else if (mutation.createIfNotExist) {
        operations.push(doc => (doc === null ? mutation.createIfNotExist : doc))
      } else if (mutation.createOrReplace) {
        operations.push(() => mutation.createOrReplace)
      } else if (mutation.delete) {
        operations.push(() => null)
      } else if (mutation.patch) {
        const patch = new Patcher(mutation.patch)
        operations.push(doc => patch.apply(doc))
      } else {
        throw new Error(`Unsupported mutation ${JSON.stringify(mutation, null, 2)}`)
      }
    })
    const prevRev = this.previousRev
    const rev = this.resultRev || this.transactionId
    this.compiled = doc => {
      if (prevRev && prevRev != doc._rev) {
        throw new Error(`Previous revision for this mutation was ${prevRev}, but the document revision is ${doc._rev}`)
      }
      const result = operations.reduce((revision, operation) => operation(revision), doc)
      if (result && rev) {
        result._rev = rev
      }
      return result
    }
  }
  apply(document : Object) : Object {
    if (!this.compiled) {
      this.compile()
    }
    return this.compiled(document)
  }
  static applyAll(document : Object, mutations : Array<Mutation>) : Object {
    return mutations.reduce((doc, mutation) => mutation.apply(doc), document)
  }
  // Given a number of yet-to-be-committed mutation objects, collects them into one big mutation
  // any metadata like transactionId is ignored and must be submitted by the client. It is assumed
  // that all mutations are on the same document.
  // TOOO: Optimize mutations, eliminating mutations that overwrite themselves!
  static squash(document : Object, mutations : Array<Mutation>) : Mutation {
    const squashed = mutations.reduce((result, mutation) => result.concat(...mutation.mutations), [])
    return new Mutation({mutations: squashed})
  }
}
