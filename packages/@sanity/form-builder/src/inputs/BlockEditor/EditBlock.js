import React, {PropTypes} from 'react'
import FormBuilderPropTypes from '../../FormBuilderPropTypes'
import equals from 'shallow-equals'
import {getFieldType} from '../../schema/getFieldType'
import styles from './styles/EditBlock.css'
import Button from 'part:@sanity/components/buttons/default'

export default class EntityForm extends React.Component {
  constructor(props, context) {
    super(props, context)
    this.handleChange = this.handleChange.bind(this)
    this.handleEnter = this.handleEnter.bind(this)
  }

  static propTypes = {
    type: FormBuilderPropTypes.type.isRequired,
    value: PropTypes.any,
    level: PropTypes.number,
    focus: PropTypes.bool,
    onChange: PropTypes.func,
    onRemove: PropTypes.func,
    onEnter: PropTypes.func,
    onClose: PropTypes.func
  };

  static contextTypes = {
    formBuilder: PropTypes.object
  };

  shouldComponentUpdate(nextProps) {
    return !equals(nextProps, this.props)
  }

  handleChange(event) {
    const {onChange} = this.props
    onChange(event)
  }

  handleEnter() {
    const {onEnter} = this.props
    onEnter()
  }

  resolveInputComponent(type, fieldType) {
    return this.context.formBuilder.resolveInputComponent(type, fieldType)
  }

  getFieldType(type) {
    return getFieldType(this.context.formBuilder.schema, type)
  }

  render() {
    const {value, type, focus, level, onClose} = this.props

    const fieldType = this.getFieldType(type)

    const InputComponent = this.context.resolveInputComponent(type, fieldType)
    if (!InputComponent) {
      return (
        <div>No input component found for type of type "{type.type}"
          <pre>{JSON.stringify(type, null, 2)}</pre>
        </div>
      )
    }

    const passSerialized = value.constructor.passSerialized

    return (
      <div className={styles.root}>
        <InputComponent
          value={passSerialized ? value.serialize() : value}
          type={type}
          type={fieldType}
          level={level}
          focus={focus}
          onEnter={this.handleEnter}
          onChange={this.handleChange}
        />
        <Button onClick={onClose}>OK</Button>
      </div>
    )
  }
}
