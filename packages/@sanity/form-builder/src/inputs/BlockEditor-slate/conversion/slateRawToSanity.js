// Converts a persisted array to a slate compatible json document
import {get, flatten} from 'lodash'

function toSanityBlock(block) {
  if (block.type === 'contentBlock') {
    return {
      ...block.data,
      _type: 'block',
      spans: flatten(block.nodes.map(child => {
        if (child.kind === 'text') {
          return child.ranges
            .map(range => {
              return {
                _type: 'span',
                text: range.text,
                marks: range.marks.map(mark => mark.type)
              }
            })
        }
        throw new Error(`Unsupported kind ${child.kind}`)
      }))
    }
  }
  return block.data.value
}

function isEmpty(blocks) {
  if (blocks.length === 0) {
    return true
  }
  if (blocks.length > 1) {
    return false
  }
  const firstBlock = blocks[0]
  if (firstBlock._type !== 'block') {
    return false
  }
  const spans = firstBlock.spans
  if (spans.length === 0) {
    return true
  }
  if (spans.length > 1) {
    return false
  }
  const firstSpan = spans[0]
  if (firstSpan._type !== 'span') {
    return false
  }
  return firstSpan.text.length === 0
}

export default function slateRawToSanity(raw) {
  const nodes = get(raw, 'document.nodes')
  if (!nodes || nodes.length === 0) {
    return undefined
  }
  const blocks = nodes.map(toSanityBlock)
  return isEmpty(blocks) ? undefined : blocks
}
