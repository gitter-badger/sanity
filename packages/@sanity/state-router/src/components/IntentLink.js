// @flow
import React, {PropTypes, Element} from 'react'
import omit from 'lodash/omit'
import Link from './Link'
import type {RouterProviderContext} from './types'

export default class IntentLink extends React.PureComponent {
  props: {
    intent: string,
    params?: Object,
    children: Element<*>,
    className: string
  };

  context: RouterProviderContext

  static contextTypes = {
    __internalRouter: PropTypes.object
  }

  render() {
    const {intent, params, children, className} = this.props

    // @todo Temporary hack
    if (intent === 'edit' && params.type) {
      return <Link href={`/desk/${params.type}/edit/${params.id.replace(/\//g, '.')}`} className={className}>{children}</Link>
    }

    const url = this.context.__internalRouter.resolveIntentLink(intent, params)
    const rest = omit(this.props, 'intent', 'params')
    return <Link href={url} className={className} {...rest} />
  }
}
