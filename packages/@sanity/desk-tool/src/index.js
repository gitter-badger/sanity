import DeskTool from './DeskTool'
import Icon from './Icon'
import {route} from 'part:@sanity/base/router'

export default {
  router: route('/:selectedType', [
    route('/:action', [
      route('/:selectedDocumentId')
    ])
  ]),
  title: 'Desk',
  name: 'desk',
  icon: Icon,
  component: DeskTool
}
