const assign = require('xtend/mutable')
const Transaction = require('./transaction')
const Patch = require('./patch')
const validators = require('../validators')

const mutationDefaults = {returnIds: true}

function DataClient(client) {
  this.client = client
}

assign(DataClient.prototype, {
  fetch(query, params) {
    return this.dataRequest('fetch', 'q', {query, params}).then(res => res.result || [])
  },

  getDocument(id) {
    return this.fetch('*[.$id == %id]', {id}).then(results => results[0])
  },

  create(doc) {
    return this._create(doc, 'create')
  },

  createIfNotExists(doc) {
    return this._create(doc, 'createIfNotExists')
  },

  createOrReplace(doc) {
    return this._create(doc, 'createOrReplace')
  },

  patch(documentId, operations) {
    validators.validateDocumentId('patch', documentId)
    return new Patch(documentId, operations, this)
  },

  delete(documentId) {
    validators.validateDocumentId('delete', documentId)
    return this.dataRequest('delete', 'm', {delete: {id: documentId}})
  },

  mutate(mutations) {
    return this.dataRequest('mutate', 'm',
      mutations instanceof Patch
        ? mutations.serialize()
        : mutations
    )
  },

  transaction(operations) {
    return new Transaction(operations, this)
  },

  dataRequest(method, endpoint, body) {
    const query = endpoint === 'm' && mutationDefaults
    return this.client.emit('request', method, body).then(() => {
      const dataset = validators.hasDataset(this.client.clientConfig)
      return this.client.request({
        method: 'POST',
        uri: `/data/${endpoint}/${dataset}`,
        json: body,
        query: query
      })
    })
  },

  _create(doc, op) {
    const dataset = validators.hasDataset(this.client.clientConfig)
    const mutation = {[op]: assign({}, doc, {$id: doc.$id || `${dataset}:`})}
    return this.dataRequest(op, 'm', mutation).then(res => ({
      transactionId: res.transactionId,
      documentId: res.docIds[0]
    }))
  }
})

module.exports = DataClient