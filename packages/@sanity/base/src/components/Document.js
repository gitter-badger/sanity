import React, {PropTypes} from 'react'
import AppLoadingScreen from './AppLoadingScreen'

function assetUrl(staticPath, item) {
  const isAbsolute = item.path.match(/^https?:\/\//)
  if (isAbsolute) {
    return item.path
  }

  const base = `${staticPath}/${item.path}`
  if (!item.hash) {
    return base
  }

  const hasQuery = base.indexOf('?') !== -1
  const separator = hasQuery ? '&' : '?'
  return `${base}${separator}${item.hash}`
}

function Document(props) {
  const stylesheets = props.stylesheets.map(item =>
    <link
      key={item.path}
      rel="stylesheet"
      href={assetUrl(props.staticPath, item)}
    />
  )

  const scripts = props.scripts.map(item =>
    <script
      key={item.path}
      src={assetUrl(props.staticPath, item)}
    />
  )

  const favicons = props.favicons.map((item, index) =>
    <link
      key={item.path + index}
      rel="icon"
      href={assetUrl(props.staticPath, item)}
    />
  )

  return (
    <html>
      <head>
        <meta charSet={props.charset} />
        <title>{props.title}</title>
        {stylesheets}
        {favicons}
        <meta name="viewport" content={props.viewport} />
      </head>
      <body>
        <div id="sanity">
          <AppLoadingScreen text={props.loading} />
        </div>
        {scripts}
      </body>
    </html>
  )
}

const asset = PropTypes.shape({
  path: PropTypes.string.isRequired,
  hash: PropTypes.string
})

Document.defaultProps = {
  charset: 'utf-8',
  title: 'Sanity',
  viewport: 'width=device-width, initial-scale=1',
  loading: 'Restoring Sanity…',
  staticPath: '/static',
  favicons: [{path: 'favicon.ico'}],
  stylesheets: [],
  scripts: []
}

Document.propTypes = {
  charset: PropTypes.string,
  title: PropTypes.string,
  viewport: PropTypes.string,
  loading: PropTypes.node,
  staticPath: PropTypes.string,
  favicons: PropTypes.arrayOf(asset),
  stylesheets: PropTypes.arrayOf(asset),
  scripts: PropTypes.arrayOf(asset)
}

export default Document
