import client from 'part:@sanity/base/client'
import {SlugInput} from '../../index'

import slugify from 'slugify'
slugify.extend({'☃': 'snowman'})
slugify.extend({'✅': 'check'})
slugify.extend({'☺': 'smiling'})
slugify.extend({'☹': 'unhappy'})
slugify.extend({'☕': 'coffee'})
slugify.extend({'✌': 'victory'})

// Default slugify for Sanity
export function sanitySlugify(type, slug) {
  return slug ? slugify(slug).toLowerCase() : undefined
}

export function validateSlug(type, slug, myDocId) {
  let query
  if (myDocId) {
    query = `*[${type.name}.current == $slug && _id != $id]`
  } else {
    query = `*[${type.name}.current == $slug`
  }
  return client.fetch(query, {slug: slug, id: myDocId})
    .then(results => {
      if (results[0]) {
        const foundDocId = results[0]._id
        return `There is already a document (${foundDocId}) `
          + `in the dataset with the slug '${slug}'.`
      }
      return null
    })
}

export default SlugInput.create({validate: validateSlug, slugify: sanitySlugify})
