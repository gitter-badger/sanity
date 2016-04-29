import React, {PropTypes} from 'react'
import styles from '../../styles/DeskTool.css'

const PaneContainer = ({children}) =>
  <nav className={styles.panes}>
    {children}
  </nav>

export default PaneContainer