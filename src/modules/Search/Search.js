import cx from 'classnames'
import keyboardKey from 'keyboard-key'
import _ from 'lodash'
import PropTypes from 'prop-types'
import React from 'react'

import {
  AutoControlledComponent as Component,
  customPropTypes,
  eventStack,
  doesNodeContainClick,
  getElementType,
  getUnhandledProps,
  htmlInputAttrs,
  isBrowser,
  makeDebugger,
  objectDiff,
  partitionHTMLProps,
  shallowEqual,
  SUI,
  useKeyOnly,
  useValueAndKey,
} from '../../lib'
import Input from '../../elements/Input'
import Label from '../../elements/Label'
import Icon from '../../elements/Icon'
import Loader from '../../elements/Loader'
import SearchCategory from './SearchCategory'
import SearchResult from './SearchResult'
import SearchResults from './SearchResults'

const getIdOrKey = (id, key) => (_.isNil(id) || _.isUndefined(id) ? key : id)

const debug = makeDebugger('search')

/**
 * A search module allows a user to query for results from a selection of data
 */
export default class Search extends Component {
  static propTypes = {
    /** An element type to render as (string or function). */
    as: customPropTypes.as,

    // ------------------------------------
    // Behavior
    // ------------------------------------

    /**
     * Whether or not the menu should close when a value is selected from the dropdown.
     * By default, multiple selection dropdowns will remain open on change, while single
     * selection dropdowns will close on change.
     */
    closeOnChange: PropTypes.bool,

    /** Initial value of open. */
    defaultOpen: PropTypes.bool,

    /** Initial value. */
    defaultValue: PropTypes.string,

    /** Initial value of selectedValue. */
    defaultSelectedValue: PropTypes.arrayOf(PropTypes.shape(SearchResult.propTypes)),

    /** Shorthand for Icon. */
    icon: PropTypes.oneOfType([PropTypes.node, PropTypes.object]),

    /** Minimum characters to query for results */
    minCharacters: PropTypes.number,

    /** Additional text for "No Results" message with less emphasis. */
    noResultsDescription: PropTypes.node,

    /** Message to display when there are no results. */
    noResultsMessage: PropTypes.node,

    /** Controls whether or not the results menu is displayed. */
    open: PropTypes.bool,

    /**
     * One of:
     * - array of Search.Result props e.g. `{ title: '', description: '' }` or
     * - object of categories e.g. `{ name: '', results: [{ title: '', description: '' }]`
     */
    results: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.shape(SearchResult.propTypes)),
      PropTypes.shape(SearchCategory.propTypes),
    ]),

    /** Whether the search should automatically select the first result after searching. */
    selectFirstResult: PropTypes.bool,

    /** Whether a "no results" message should be shown if no results are found. */
    showNoResults: PropTypes.bool,

    /** Current value of the search input. Creates a controlled component. */
    value: PropTypes.string,

    /** Enable multi selection */
    multiple: PropTypes.bool,

    /** When multi selected, store the selected value */
    selectedValue: customPropTypes.every([
      customPropTypes.demand(['multiple']),
      PropTypes.arrayOf(PropTypes.shape(SearchResult.propTypes)),
    ]),

    /** current selected label */
    selectedLabel: customPropTypes.every([
      customPropTypes.demand(['multiple']),
      PropTypes.shape(SearchResult.propTypes),
    ]),

    // ------------------------------------
    // Rendering
    // ------------------------------------

    /**
     * Renders the SearchCategory contents.
     *
     * @param {object} props - The SearchCategory props object.
     * @returns {*} - Renderable SearchCategory contents.
     */
    categoryRenderer: PropTypes.func,

    /**
     * Renders the SearchResult contents.
     *
     * @param {object} props - The SearchResult props object.
     * @returns {*} - Renderable SearchResult contents.
     */
    resultRenderer: PropTypes.func,

    // ------------------------------------
    // Callbacks
    // ------------------------------------

    /**
     * Called on blur.
     *
     * @param {SyntheticEvent} event - React's original SyntheticEvent.
     * @param {object} data - All props.
     */
    onBlur: PropTypes.func,

    /**
     * Called on focus.
     *
     * @param {SyntheticEvent} event - React's original SyntheticEvent.
     * @param {object} data - All props.
     */
    onFocus: PropTypes.func,

    /**
     * Called on mousedown.
     *
     * @param {SyntheticEvent} event - React's original SyntheticEvent.
     * @param {object} data - All props.
     */
    onMouseDown: PropTypes.func,

    /**
     * Called when a result is selected.
     *
     * @param {SyntheticEvent} event - React's original SyntheticEvent.
     * @param {object} data - All props.
     */
    onResultSelect: PropTypes.func,

    /**
     * Called on search input change.
     *
     * @param {SyntheticEvent} event - React's original SyntheticEvent.
     * @param {object} data - All props, includes current value of search input.
     */
    onSearchChange: PropTypes.func,

    /**
     * Called when the active selection index is changed.
     *
     * @param {SyntheticEvent} event - React's original SyntheticEvent.
     * @param {object} data - All props.
     */
    onSelectionChange: PropTypes.func,

    /**
     * Mapped over the active items and returns shorthand for the active item Labels.
     * Only applies to `multiple` Search.
     *
     * @param {object} item - A currently active dropdown item.
     * @param {number} index - The current index.
     * @param {object} defaultLabelProps - The default props for an active item Label.
     * @returns {*} Shorthand for a Label.
     */
    renderLabel: PropTypes.func,

    // ------------------------------------
    // Style
    // ------------------------------------

    /** A search can have its results aligned to its left or right container edge. */
    aligned: PropTypes.string,

    /** A search can display results from remote content ordered by categories. */
    category: PropTypes.bool,

    /** Additional classes. */
    className: PropTypes.string,

    /** A search can have its results take up the width of its container. */
    fluid: PropTypes.bool,

    /** A search input can take up the width of its container. */
    input: customPropTypes.itemShorthand,

    /** A search can show a loading indicator. */
    loading: PropTypes.bool,

    /** A search can have different sizes. */
    size: PropTypes.oneOf(_.without(SUI.SIZES, 'medium')),
  }

  static defaultProps = {
    icon: 'search',
    input: 'text',
    minCharacters: 1,
    noResultsMessage: 'No results found.',
    showNoResults: true,
    renderLabel: ({ title }) => title,
  }

  static autoControlledProps = ['open', 'value', 'selectedValue']

  handleRef = c => (this.ref = c)
  handleInputRef = c => (this.inputRef = c)
  handleSizerRef = c => (this.sizerRef = c)

  static Category = SearchCategory
  static Result = SearchResult
  static Results = SearchResults

  componentWillMount() {
    debug('componentWillMount()')
    const { open, value } = this.state

    this.setValue(value)
    if (open) this.open()
  }

  componentWillReceiveProps(nextProps) {
    super.componentWillReceiveProps(nextProps)
    debug('componentWillReceiveProps()')
    debug('changed props:', objectDiff(nextProps, this.props))

    if (!shallowEqual(nextProps.value, this.props.value)) {
      debug('value changed, setting', nextProps.value)
      this.setValue(nextProps.value)
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !shallowEqual(nextProps, this.props) || !shallowEqual(nextState, this.state)
  }

  componentDidUpdate(prevProps, prevState) {
    // eslint-disable-line complexity
    debug('componentDidUpdate()')
    debug('to state:', objectDiff(prevState, this.state))

    // focused / blurred
    if (!prevState.focus && this.state.focus) {
      debug('search focused')
      if (!this.isMouseDown) {
        debug('mouse is not down, opening')
        this.tryOpen()
      }
      if (this.state.open) {
        eventStack.sub('keydown', [this.moveSelectionOnKeyDown, this.selectItemOnEnter])
      }
    } else if (prevState.focus && !this.state.focus) {
      debug('search blurred')
      if (!this.isMouseDown) {
        debug('mouse is not down, closing')
        this.close()
      }
      eventStack.unsub('keydown', [this.moveSelectionOnKeyDown, this.selectItemOnEnter])
    }

    // opened / closed
    if (!prevState.open && this.state.open) {
      debug('search opened')
      this.open()
      eventStack.sub('click', this.closeOnDocumentClick)
      eventStack.sub('keydown', [
        this.closeOnEscape,
        this.moveSelectionOnKeyDown,
        this.selectItemOnEnter,
      ])
    } else if (prevState.open && !this.state.open) {
      debug('search closed')
      this.handleClose()
      eventStack.unsub('click', this.closeOnDocumentClick)
      eventStack.unsub('keydown', [
        this.closeOnEscape,
        this.moveSelectionOnKeyDown,
        this.selectItemOnEnter,
      ])
    }
  }

  componentWillUnmount() {
    debug('componentWillUnmount()')

    eventStack.unsub('click', this.closeOnDocumentClick)
    eventStack.unsub('keydown', [
      this.closeOnEscape,
      this.moveSelectionOnKeyDown,
      this.selectItemOnEnter,
    ])
  }

  closeOnChange = (e) => {
    const { closeOnChange, multiple } = this.props
    const shouldClose = _.isUndefined(closeOnChange) ? !multiple : closeOnChange

    if (shouldClose) this.close(e)
  }

  clearSearchQuery = () => {
    debug('clearSearchQuery()')
    this.setState({ value: '' })
  }

  handleClose = () => {
    debug('handleClose()')

    const hasFocus = document.activeElement === this.ref

    this.ref.blur()
    this.clearSearchQuery()

    this.setState({ focus: hasFocus })
  }

  // ----------------------------------------
  // Document Event Handlers
  // ----------------------------------------

  handleResultSelect = (e, result) => {
    debug('handleResultSelect()')
    debug(result)

    const { multiple } = this.props
    if (!multiple) {
      _.invoke(this.props, 'onResultSelect', e, { ...this.props, result })
      return
    }

    // multiple mode enable both add and remove, thus call 'onResultSelect'
    // in handleResultRemove or handleResultAdd respectively
    if (result.selected) {
      this.handleResultRemove(e, result)
    } else {
      this.handleResultAdd(e, result)
    }
  }

  resetResultFlag = (result, flag) => {
    const results = this.getFlattenedResults()
    const newResult = result
    newResult.selected = flag
    _.set(results, this.state.selectedIndex, newResult)
    this.setState({ results })
  }

  handleResultAdd = (e, result) => {
    debug('handleResultAdd()')
    this.resetResultFlag(result, true)
    const newSelectedValue = _.union(this.state.selectedValue, [result])

    _.invoke(this.props, 'onResultSelect', e, { ...this.props, selectedValue: newSelectedValue })
    this.setState({ selectedValue: newSelectedValue })
  }

  handleResultRemove = (e, result) => {
    const { selectedValue } = this.state
    debug('handleResultRemove()', selectedValue, result)

    this.resetResultFlag(result, false)

    const newSelectedValue = _.filter(
      this.state.selectedValue,
      v => getIdOrKey(v.id, v.title) !== getIdOrKey(result.id, result.title),
    )

    _.invoke(this.props, 'onResultSelect', e, { ...this.props, selectedValue: newSelectedValue })
    this.setState({ selectedValue: newSelectedValue })
  }

  handleResultRemoveAll = (e) => {
    debug('handleResultRemoveAll()')
    const { selectedValue } = this.state
    _.forEach(selectedValue, v => this.resetResultFlag(v, false))
    const newSelectedValue = []

    _.invoke(this.props, 'onResultSelect', e, { ...this.props, selectedValue: newSelectedValue })
    this.setState({ selectedValue: newSelectedValue })
  }

  handleSelectionChange = (e) => {
    debug('handleSelectionChange()')

    const result = this.getSelectedResult()
    _.invoke(this.props, 'onSelectionChange', e, { ...this.props, result })
  }

  closeOnEscape = (e) => {
    if (keyboardKey.getCode(e) !== keyboardKey.Escape) return
    e.preventDefault()
    this.close()
  }

  moveSelectionOnKeyDown = (e) => {
    debug('moveSelectionOnKeyDown()')
    debug(keyboardKey.getKey(e))
    switch (keyboardKey.getCode(e)) {
      case keyboardKey.ArrowDown:
        e.preventDefault()
        this.moveSelectionBy(e, 1)
        break
      case keyboardKey.ArrowUp:
        e.preventDefault()
        this.moveSelectionBy(e, -1)
        break
      default:
        break
    }
  }

  selectItemOnEnter = (e) => {
    debug('selectItemOnEnter()')
    debug(keyboardKey.getKey(e))
    if (keyboardKey.getCode(e) !== keyboardKey.Enter) return

    const result = this.getSelectedResult()

    // prevent selecting null if there was no selected item value
    if (!result) return

    e.preventDefault()

    // notify the onResultSelect prop that the user is trying to change value
    const { multiple } = this.props
    if (!multiple) this.setValue(result.title)
    this.handleResultSelect(e, result)
    this.closeOnChange(e)
  }

  closeOnDocumentClick = (e) => {
    debug('closeOnDocumentClick()')
    debug(e)

    if (this.ref && doesNodeContainClick(this.ref, e)) return
    this.close()
  }

  // ----------------------------------------
  // Component Event Handlers
  // ----------------------------------------

  handleMouseDown = (e) => {
    debug('handleMouseDown()')

    this.isMouseDown = true
    _.invoke(this.props, 'onMouseDown', e, this.props)
    eventStack.sub('mouseup', this.handleDocumentMouseUp)
  }

  handleDocumentMouseUp = () => {
    debug('handleDocumentMouseUp()')

    this.isMouseDown = false
    eventStack.unsub('mouseup', this.handleDocumentMouseUp)
  }

  handleInputClick = (e) => {
    debug('handleInputClick()', e)

    // prevent closeOnDocumentClick()
    e.nativeEvent.stopImmediatePropagation()

    this.tryOpen()
  }

  handleItemClick = (e, { id }) => {
    debug('handleItemClick()')
    debug(id)
    const result = this.getSelectedResult(id)

    // prevent closeOnDocumentClick()
    e.nativeEvent.stopImmediatePropagation()
    const { multiple } = this.props

    // notify the onResultSelect prop that the user is trying to change value
    if (!multiple) this.setValue(result.title)
    this.handleResultSelect(e, result)
    this.closeOnChange(e)
  }

  handleFocus = (e) => {
    debug('handleFocus()')
    const { onFocus } = this.props
    if (onFocus) onFocus(e, this.props)
    this.setState({ focus: true })
  }

  handleBlur = (e) => {
    debug('handleBlur()')
    const { onBlur } = this.props
    if (onBlur) onBlur(e, this.props)
    this.setState({ focus: false })
  }

  handleSearchChange = (e) => {
    debug('handleSearchChange()')
    debug(e.target.value)
    // prevent propagating to this.props.onChange()
    e.stopPropagation()
    const { minCharacters } = this.props
    const { open } = this.state
    const newQuery = e.target.value

    _.invoke(this.props, 'onSearchChange', e, { ...this.props, value: newQuery })

    // open search dropdown on search query
    if (newQuery.length < minCharacters) {
      this.close()
    } else if (!open) {
      this.tryOpen(newQuery)
    }

    this.setValue(newQuery)
  }

  handleLabelClick = (e, labelProps) => {
    debug('handleLabelClick()')
    // prevent focusing search input on click
    e.stopPropagation()

    this.setState({ selectedLabel: labelProps.value })
    _.invoke(this.props, 'onLabelClick', e, labelProps)
  }

  handleLabelRemove = (e, labelProps) => {
    debug('handleLabelRemove()', labelProps)
    // prevent focusing search input on click
    e.stopPropagation()
    this.handleResultRemove(e, labelProps.value)
  }

  // ----------------------------------------
  // Getters
  // ----------------------------------------

  getFlattenedResults = () => {
    const { category, results } = this.props

    return !category
      ? results
      : _.reduce(results, (memo, categoryData) => memo.concat(categoryData.results), [])
  }

  getSelectedResult = (index = this.state.selectedIndex) => {
    const results = this.getFlattenedResults()
    return _.get(results, index)
  }

  // ----------------------------------------
  // Setters
  // ----------------------------------------

  setValue = (value) => {
    debug('setValue()')
    debug('value', value)

    const { selectFirstResult } = this.props

    this.trySetState({ value }, { selectedIndex: selectFirstResult ? 0 : -1 })
  }

  moveSelectionBy = (e, offset) => {
    debug('moveSelectionBy()')
    debug(`offset: ${offset}`)
    const { selectedIndex } = this.state

    const results = this.getFlattenedResults()
    const lastIndex = results.length - 1

    // next is after last, wrap to beginning
    // next is before first, wrap to end
    let nextIndex = selectedIndex + offset
    if (nextIndex > lastIndex) nextIndex = 0
    else if (nextIndex < 0) nextIndex = lastIndex

    this.setState({ selectedIndex: nextIndex })
    this.scrollSelectedItemIntoView()
    this.handleSelectionChange(e)
  }

  // ----------------------------------------
  // Behavior
  // ----------------------------------------

  scrollSelectedItemIntoView = () => {
    debug('scrollSelectedItemIntoView()')
    // Do not access document when server side rendering
    if (!isBrowser()) return
    const menu = document.querySelector('.ui.search.active.visible .results.visible')
    const item = menu.querySelector('.result.active')
    if (!item) return
    debug(`menu (results): ${menu}`)
    debug(`item (result): ${item}`)
    const isOutOfUpperView = item.offsetTop < menu.scrollTop
    const isOutOfLowerView = item.offsetTop + item.clientHeight > menu.scrollTop + menu.clientHeight

    if (isOutOfUpperView) {
      menu.scrollTop = item.offsetTop
    } else if (isOutOfLowerView) {
      menu.scrollTop = item.offsetTop + item.clientHeight - menu.clientHeight
    }
  }

  // Open if the current value is greater than the minCharacters prop
  tryOpen = (currentValue = this.state.value) => {
    debug('open()')

    const { minCharacters } = this.props
    if (currentValue.length < minCharacters) return

    this.open()
  }

  open = () => {
    debug('open()')
    this.trySetState({ open: true })
  }

  close = () => {
    debug('close()')
    this.trySetState({ open: false })
  }

  // ----------------------------------------
  // Render
  // ----------------------------------------

  renderSearchInput = (rest) => {
    const { icon, input } = this.props
    const { value } = this.state

    let props = { icon, ...rest }
    const { loading, ...rest2 } = rest
    // do not render icon in multple mode, as the icon already rendered before
    if (this.props.multiple) {
      props = rest2
    }

    return Input.create(input, {
      autoGenerateKey: false,
      defaultProps: {
        ...props,
        input: { className: 'prompt', tabIndex: '0', autoComplete: 'off' },
        onChange: this.handleSearchChange,
        onClick: this.handleInputClick,
        value,
        ref: this.handleInputRef,
        style: { width: this.computeSearchInputWidth() },
      },
    })
  }

  renderLabels = () => {
    debug('renderLabels()')
    const { multiple, renderLabel } = this.props
    const { selectedValue, selectedLabel } = this.state
    if (!multiple || _.isEmpty(selectedValue)) {
      return
    }

    const selectedItems = _.map(selectedValue, this.getItembyValue)
    return _.map(_.compact(selectedItems), (item, index) => {
      const defaultProps = {
        active: item === selectedLabel,
        as: 'a',
        key: getIdOrKey(item.id, item.title),
        onClick: this.handleLabelClick,
        onRemove: this.handleLabelRemove,
        value: item,
      }

      return Label.create(renderLabel(item, index, defaultProps), { defaultProps })
    })
  }

  renderRemoveButton = () => {
    debug('renderRemoveButton')

    const { multiple } = this.props
    const { selectedValue } = this.state

    if (!multiple || _.isEmpty(selectedValue)) {
      return
    }

    return <Icon circular name='remove' onClick={this.handleResultRemoveAll} size='small' link />
  }

  renderNoResults = () => {
    const { noResultsDescription, noResultsMessage } = this.props

    return (
      <div className='message empty'>
        <div className='header'>{noResultsMessage}</div>
        {noResultsDescription && <div className='description'>{noResultsDescription}</div>}
      </div>
    )
  }

  /**
   * Offset is needed for determining the active item for results within a
   * category. Since the index is reset to 0 for each new category, an offset
   * must be passed in.
   */
  renderResult = ({ childKey, ...result }, index, _array, offset = 0) => {
    const { resultRenderer } = this.props
    const { selectedIndex } = this.state
    const offsetIndex = index + offset

    return (
      <SearchResult
        key={childKey || result.title}
        active={selectedIndex === offsetIndex}
        onClick={this.handleItemClick}
        renderer={resultRenderer}
        {...result}
        id={offsetIndex} // Used to lookup the result on item click
      />
    )
  }

  renderResults = () => {
    const { results } = this.props

    return _.map(results, this.renderResult)
  }

  renderCategories = () => {
    const { categoryRenderer, results: categories } = this.props
    const { selectedIndex } = this.state

    let count = 0

    return _.map(categories, ({ childKey, ...category }) => {
      const categoryProps = {
        key: childKey || category.name,
        active: _.inRange(selectedIndex, count, count + category.results.length),
        renderer: categoryRenderer,
        ...category,
      }
      const renderFn = _.partialRight(this.renderResult, count)

      count += category.results.length

      return <SearchCategory {...categoryProps}>{category.results.map(renderFn)}</SearchCategory>
    })
  }

  renderMenuContent = () => {
    const { category, showNoResults, results } = this.props

    if (_.isEmpty(results)) {
      return showNoResults ? this.renderNoResults() : null
    }

    return category ? this.renderCategories() : this.renderResults()
  }

  renderResultsMenu = () => {
    const { open } = this.state
    const resultsClasses = open ? 'visible' : ''
    const menuContent = this.renderMenuContent()

    if (!menuContent) return

    return <SearchResults className={resultsClasses}>{menuContent}</SearchResults>
  }

  renderFrontSearchIcon = () => {
    if (!this.props.multiple) return

    if (this.props.loading) return <Loader active inline size='tiny' />
    return <Icon name='search' />
  }

  computeSearchInputWidth = () => {
    const { value } = this.state
    if (this.sizerRef) {
      this.sizerRef.style.display = 'inline'
      this.sizerRef.textContent = value
      const searchWidth = Math.ceil(this.sizerRef.getBoundingClientRect().width)
      this.sizerRef.state.removeProperty('display')

      return searchWidth
    }
  }

  render() {
    debug('render()')
    debug('props', this.props)
    debug('state', this.state)
    const { searchClasses, focus, open } = this.state

    const { aligned, category, className, fluid, loading, size } = this.props

    // Classes
    const classes = cx(
      'ui',
      open && 'active visible',
      size,
      searchClasses,
      useKeyOnly(category, 'category'),
      useKeyOnly(focus, 'focus'),
      useKeyOnly(fluid, 'fluid'),
      useKeyOnly(loading, 'loading'),
      useValueAndKey(aligned, 'aligned'),
      'search',
      className,
    )
    const unhandled = getUnhandledProps(Search, this.props)
    const ElementType = getElementType(Search, this.props)
    const [htmlInputProps, rest] = partitionHTMLProps(unhandled, {
      htmlProps: htmlInputAttrs,
    })

    return (
      <ElementType
        {...rest}
        className={classes}
        onBlur={this.handleBlur}
        onFocus={this.handleFocus}
        onMouseDown={this.handleMouseDown}
        ref={this.handleRef}
      >
        {this.renderFrontSearchIcon()}
        {this.renderLabels()}
        {this.renderSearchInput(htmlInputProps)}
        {this.renderRemoveButton()}
        {this.renderResultsMenu()}
      </ElementType>
    )
  }
}
