!(function($){

	"use strict";

	var Navigator = function ( element, options ) {
		this._init(element, options)
	}

	Navigator.prototype = {

		constructor: Navigator

	/****************************
		Main functions
	****************************/

	, _init: function ( element, options ) {
			var that = this

			this.$element = $(element)
			this.options = $.extend(true, {}, $.fn.cytoscapeNavigator.defaults, options)
			this.cy = this.$element.cytoscape('get')

			// Cache sizes
			this.width = this.$element.width()
			this.height = this.$element.height()

			// Cache bounding box
			this.boundingBox = this.cy.elements().boundingBox()

			// Init components
			this._initPanel()
			this._initThumbnail()
			this._initView()
			this._initOverlay()

			// Hook element resize
			this.$element.on('resize', $.proxy(this.resize, this))
		}

	, destroy: function () {
			this.$panel.remove()
			this.$element.removeData('navigator')
		}

	/****************************
		Navigator elements functions
	****************************/

		/*
		 * Used inner attributes
		 *
		 * w {number} width
		 * h {number} height
		 */
	, _initPanel: function () {
			var options = this.options

			if( options.container ) {
				if( options.container instanceof jQuery ){
					if( options.container.length > 0 ){
						this.$panel = options.container.first()
					} else {
						$.error("Container for jquery.cyNavigator is empty")
						return
					}
				} else if ( $(options.container).length > 0 ) {
					this.$panel = $(options.container).first()
				} else {
					$.error("There is no any element matching your selector for jquery.cyNavigator")
					return
				}
			} else {
				this.$panel = $('<div class="cytoscape-navigator"/>')
				this.$element.append(this.$panel)
			}

			this._setupPanel()
		}

	, _setupPanel: function () {
			var options = this.options

			// Cache sizes
			this.$panel.w = this.$panel.width()
			this.$panel.h = this.$panel.height()
		}

		/*
		 * Used inner attributes
		 *
		 * zoom {number}
		 * pan {object} - {x: 0, y: 0}
		 */
	, _initThumbnail: function () {
			// Create thumbnail
			this.$thumbnail = $('<canvas/>')

			// Add thumbnail canvas to the DOM
			this.$panel.append(this.$thumbnail)

			// Setup thumbnail
			this._setupThumbnailSizes()
			this._setupThumbnail()

			// Repopulate thumbnail after graph render
			this.cy.on('initrender', $.proxy(this._checkThumbnailSizesAndUpdate, this))

			// Thumbnail updates
			if (this.options.thumbnailLiveFramerate === false) {
				this._hookGraphUpdates()
			} else {
				this._setGraphUpdatesTimer()
			}
		}

	, _setupThumbnail: function () {
			// Setup Canvas
			this.$thumbnail.attr('width', this.$panel.w)
			this.$thumbnail.attr('height', this.$panel.h)

			this._updateThumbnailImage()
		}

	, _setupThumbnailSizes: function () {
			// Update bounding box cache
			this.boundingBox = this.cy.elements().boundingBox()

			this.$thumbnail.zoom = Math.min(this.$panel.h / this.boundingBox.h, this.$panel.w / this.boundingBox.w)

			// Used on thumbnail generation
			this.$thumbnail.pan = {
				x: (this.$panel.w - this.$thumbnail.zoom * (this.boundingBox.x1 + this.boundingBox.x2))/2
			, y: (this.$panel.h - this.$thumbnail.zoom * (this.boundingBox.y1 + this.boundingBox.y2))/2
			}
		}

		// If bounding box has changed then update sizes
		// Otherwise just update the thumbnail
	, _checkThumbnailSizesAndUpdate: function () {
			// Cache previous values
			var _zoom = this.$thumbnail.zoom
			  , _pan_x = this.$thumbnail.pan.x
			  , _pan_y = this.$thumbnail.pan.y

			this._setupThumbnailSizes()

			if (_zoom != this.$thumbnail.zoom || _pan_x != this.$thumbnail.pan.x || _pan_y != this.$thumbnail.pan.y) {
				this._setupThumbnail()
				this._setupView()
			} else {
				this._updateThumbnailImage()
			}
		}

		/*
		 * Used inner attributes
		 *
		 * w {number} width
		 * h {number} height
		 * x {number}
		 * y {number}
		 * borderWidth {number}
		 * locked {boolean}
		 */
	, _initView: function () {
			var that = this

			this.$view = $('<div class="cytoscape-navigatorView"/>')
			this.$panel.append(this.$view)

			// Compute borders
			this.$view.borderTop = parseInt(this.$view.css('border-top-width'), 10)
			this.$view.borderRight = parseInt(this.$view.css('border-right-width'), 10)
			this.$view.borderBottom = parseInt(this.$view.css('border-bottom-width'), 10)
			this.$view.borderLeft = parseInt(this.$view.css('border-left-width'), 10)

			// Abstract borders
			this.$view.borderHorizontal = this.$view.borderLeft + this.$view.borderRight
			this.$view.borderVertical = this.$view.borderTop + this.$view.borderBottom

			this._setupView()

			// Hook graph zoom and pan
			this.cy.on('zoom pan', $.proxy(this._setupView, this))
		}

	, _setupView: function () {
			if (this.$view.locked)
				return

			var cyZoom = this.cy.zoom()
			  , cyPan = this.cy.pan()

			// Horizontal computation
			this.$view.w = this.width / cyZoom * this.$thumbnail.zoom
			this.$view.x = -cyPan.x * this.$view.w / this.width + this.$thumbnail.pan.x - this.$view.borderLeft

			// Vertical computation
			this.$view.h = this.height / cyZoom * this.$thumbnail.zoom
			this.$view.y = -cyPan.y * this.$view.h / this.height + this.$thumbnail.pan.y - this.$view.borderTop

			// CSS view
			this.$view
				.width(this.$view.w)
				.height(this.$view.h)
				.css({
				  left: this.$view.x
				, top: this.$view.y
				})
		}

		/*
		 * Used inner attributes
		 *
		 * timeout {number} used to keep stable frame rate
		 * lastMoveStartTime {number}
		 * inMovement {boolean}
		 * hookPoint {object} {x: 0, y: 0}
		 */
	, _initOverlay: function () {
			// Used to capture mouse events
			this.$overlay = $('<div class="cytoscape-navigatorOverlay"/>')

			// Add overlay to the DOM
			this.$panel.append(this.$overlay)

			// Init some attributes
			this.$overlay.hookPoint = {x: 0, y: 0}

			// Listen for events
			this._initEventsHandling()
		}

	/****************************
		Event handling functions
	****************************/

	, resize: function () {
			// Cache sizes
			this.width = this.$element.width()
			this.height = this.$element.height()

			this._setupPanel()
			this._checkThumbnailSizesAndUpdate()
			this._setupView()
		}

	, _initEventsHandling: function () {
			var that = this
				, eventsLocal = [
				// Mouse events
				  'mousedown'
				, 'mousewheel'
				, 'DOMMouseScroll' // Mozilla specific event
				// Touch events
				, 'touchstart'
				]
				, eventsGlobal = [
				  'mouseup'
				, 'mouseout'
				, 'mousemove'
				// Touch events
				, 'touchmove'
				, 'touchend'
				]

			// handle events and stop their propagation
			this.$overlay.on(eventsLocal.join(' '), function (ev) {
				// Touch events
				if (ev.type == 'touchstart') {
					// Will count as middle of View
					ev.offsetX = that.$view.x + that.$view.w / 2
					ev.offsetY = that.$view.y + that.$view.h / 2
				}

				// Normalize offset for browsers which do not provide that value
				if (ev.offsetX === undefined || ev.offsetY === undefined) {
					var targetOffset = $(ev.target).offset()
					ev.offsetX = ev.pageX - targetOffset.left
					ev.offsetY = ev.pageY - targetOffset.top
				}

				if (ev.type == 'mousedown' || ev.type == 'touchstart') {
					that._eventMoveStart(ev)
				} else if (ev.type == 'mousewheel' || ev.type == 'DOMMouseScroll') {
					that._eventZoom(ev)
				}

				// Prevent default and propagation
				// Don't use peventPropagation as it breaks mouse events
				return false;
			})

			// Hook global events
			$('body').on(eventsGlobal.join(' '), function (ev) {
				// Do not make any computations if it is has no effect on Navigator
				if (!that.$overlay.inMovement)
					return;

				// Touch events
				if (ev.type == 'touchend') {
					// Will count as middle of View
					ev.offsetX = that.$view.x + that.$view.w / 2
					ev.offsetY = that.$view.y + that.$view.h / 2
				} else if (ev.type == 'touchmove') {
					// Hack - we take in account only first touch
					ev.pageX = ev.originalEvent.touches[0].pageX
					ev.pageY = ev.originalEvent.touches[0].pageY
				}

				// Normalize offset for browsers which do not provide that value
				if (ev.offsetX === undefined || ev.offsetY === undefined) {
					var targetOffset = $(ev.target).offset()
					ev.offsetX = ev.pageX - targetOffset.left
					ev.offsetY = ev.pageY - targetOffset.top
				}

				// Translate global events into local coordinates
				if (ev.target !== that.$overlay[0]) {
					var targetOffset = $(ev.target).offset()
					  , overlayOffset = that.$overlay.offset()

					ev.offsetX = ev.offsetX - overlayOffset.left + targetOffset.left
					ev.offsetY = ev.offsetY - overlayOffset.top + targetOffset.top
				}

				if (ev.type == 'mousemove' || ev.type == 'touchmove') {
					that._eventMove(ev)
				} else if (ev.type == 'mouseup' || ev.type == 'touchend') {
					that._eventMoveEnd(ev)
				}

				// Prevent default and propagation
				// Don't use peventPropagation as it breaks mouse events
				return false;
			})
		}

	, _eventMoveStart: function (ev) {
			var now = new Date().getTime()

			// Check if it was double click
			if (this.$overlay.lastMoveStartTime
				&& this.$overlay.lastMoveStartTime + this.options.dblClickDelay > now) {
				// Reset lastMoveStartTime
				this.$overlay.lastMoveStartTime = 0
				// Enable View in order to move it to the center
				this.$overlay.inMovement = true

				// Set hook point as View center
				this.$overlay.hookPoint.x = this.$view.w / 2
				this.$overlay.hookPoint.y = this.$view.h / 2

				// Move View to start point
				if (this.options.viewLiveFramerate !== false) {
					this._eventMove({
					  offsetX: this.$panel.w / 2
					, offsetY: this.$panel.h / 2
					})
				} else {
					this._eventMoveEnd({
					  offsetX: this.$panel.w / 2
					, offsetY: this.$panel.h / 2
					})
				}

				// View should be inactive as we don't want to move it right after double click
				this.$overlay.inMovement = false
			}
			// This is a single click
			// Take care as single click happens before double click 2 times
			else {
				this.$overlay.lastMoveStartTime = now
				this.$overlay.inMovement = true
				// Lock view moving caused by cy events
				this.$view.locked = true

				// if event started in View
				if (ev.offsetX >= this.$view.x && ev.offsetX <= this.$view.x + this.$view.w
					&& ev.offsetY >= this.$view.y && ev.offsetY <= this.$view.y + this.$view.h
				) {
					this.$overlay.hookPoint.x = ev.offsetX - this.$view.x
					this.$overlay.hookPoint.y = ev.offsetY - this.$view.y
				}
				// if event started in Thumbnail (outside of View)
				else {
					// Set hook point as View center
					this.$overlay.hookPoint.x = this.$view.w / 2
					this.$overlay.hookPoint.y = this.$view.h / 2

					// Move View to start point
					this._eventMove(ev)
				}
			}
		}

	, _eventMove: function (ev) {
			var that = this

			this._checkMousePosition(ev)

			// break if it is useless event
			if (!this.$overlay.inMovement) {
				return;
			}

			// Update cache
			this.$view.x = ev.offsetX - this.$overlay.hookPoint.x
			this.$view.y = ev.offsetY - this.$overlay.hookPoint.y

			// Update view position
			this.$view.css('left', this.$view.x)
			this.$view.css('top', this.$view.y)

			// Move Cy
			if (this.options.viewLiveFramerate !== false) {
				// trigger instantly
				if (this.options.viewLiveFramerate == 0) {
					this._moveCy()
				}
				// trigger less often than frame rate
				else if (!this.$overlay.timeout) {
					// Set a timeout for graph movement
					this.$overlay.timeout = setTimeout(function () {
						that._moveCy()
						that.$overlay.timeout = false
					}, 1000/this.options.viewLiveFramerate)
				}
			}
		}

	, _checkMousePosition: function (ev) {
			// If mouse in over View
			if(ev.offsetX > this.$view.x && ev.offsetX < this.$view.x + this.$view.borderHorizontal + this.$view.w
				&& ev.offsetY > this.$view.y && ev.offsetY < this.$view.y + this.$view.borderVertical + this.$view.h) {
				this.$panel.addClass('mouseover-view')
			} else {
				this.$panel.removeClass('mouseover-view')
			}
		}

	, _eventMoveEnd: function (ev) {
			// Unlock view changing caused by graph events
			this.$view.locked = false

			// Remove class when mouse is not over Navigator
			this.$panel.removeClass('mouseover-view')

			if (!this.$overlay.inMovement) {
				return;
			}

			// Trigger one last move
			this._eventMove(ev)

			// If mode is not live then move graph on drag end
			if (this.options.viewLiveFramerate === false) {
				this._moveCy()
			}

			// Stop movement permission
			this.$overlay.inMovement = false
		}

	, _eventZoom: function (ev) {
			var zoomRate = Math.pow(10, ev.originalEvent.wheelDeltaY / 1000 || ev.originalEvent.wheelDelta / 1000 || ev.originalEvent.detail / -32)
				, mousePosition = {
					  left: ev.offsetX
					, top: ev.offsetY
					}

			if (this.cy.zoomingEnabled()) {
				this._zoomCy(zoomRate, mousePosition)
			}
		}

	, _hookGraphUpdates: function () {
			this.cy.on('position add remove data', $.proxy(this._checkThumbnailSizesAndUpdate, this, false))
		}

	, _setGraphUpdatesTimer: function () {
			var delay = 1000.0 / this.options.thumbnailLiveFramerate
				, that = this
				, updateFunction = function () {
						// Use timeout instead of interval as it is not accumulating events if events pool is not processed fast enough
						setTimeout(function (){
							that._checkThumbnailSizesAndUpdate(true)
							updateFunction()
						}, delay)
					}

			// Init infinite loop
			updateFunction()
		}

	, _updateThumbnailImage: function (force_refresh) {
			var that = this
				, timeout = 0 // will remain 0 if force_refresh is true

			// Set thumbnail update frame rate
			if (!force_refresh && this.options.thumbnailEventFramerate > 0) {
				timeout = ~~(1000 / this.options.thumbnailEventFramerate)
			}

			if (this._thumbnailUpdateTimeout === undefined || this._thumbnailUpdateTimeout === null) {
				this._thumbnailUpdateTimeout = setTimeout(function(){
					// Copy scaled thumbnail to buffer
					that.cy.renderTo(that.$thumbnail[0].getContext('2d'), that.$thumbnail.zoom, that.$thumbnail.pan)

					// Reset flag
					that._thumbnailUpdateTimeout = null
				}, timeout)
			}
		}

	/****************************
		Navigator view moving
	****************************/

	, _moveCy: function () {
			this.cy.pan({
			  x: -(this.$view.x + this.$view.borderLeft - this.$thumbnail.pan.x) * this.width / this.$view.w
			, y: -(this.$view.y + this.$view.borderLeft - this.$thumbnail.pan.y) * this.height / this.$view.h
			})
		}

	/**
	 * Zooms graph.
	 *
	 * @this {cytoscapeNavigator}
	 * @param {number} zoomRate The zoom rate value. 1 is 100%.
	 */
	, _zoomCy: function (zoomRate, zoomCenterRaw) {
			var zoomCenter
				, isZoomCenterInView = false

			if (zoomCenterRaw) {
				isZoomCenterInView = (zoomCenterRaw.left > this.$view.x) && (zoomCenterRaw.left < this.$view.x + this.$view.w + this.$view.borderHorizontal)
					&& (zoomCenterRaw.top > this.$view.y) && (zoomCenterRaw.top < this.$view.y + this.$view.h + this.$view.borderVertical)
			}

			if (zoomCenterRaw && isZoomCenterInView) {
				// Zoom about mouse position
				zoomCenter = {
				  x: (zoomCenterRaw.left - this.$view.x - this.$view.borderLeft) * this.width / this.$view.w
				, y: (zoomCenterRaw.top - this.$view.y - this.$view.borderTop) * this.height / this.$view.h
				}
			} else {
				// Zoom abount View center
				zoomCenter = {
				  x: this.width / 2
				, y: this.height / 2
				}
			}

			this.cy.zoom({
				level: this.cy.zoom() * zoomRate
			, position: zoomCenter
			})
		}
	}

	$.fn.cytoscapeNavigator = function ( option ) {
		var _arguments = arguments

		return this.each(function () {
			var $this = $(this)
			  , data = $this.data('navigator')
			  , options = typeof option == 'object' && option

			if (!data) {
				$this.data('navigator', (data = new Navigator(this, options)))
			}

			if (typeof option == 'string') {
				if (data[option] === undefined) {
					$.error("cyNavigator has no such method")
				} else if (typeof data[option] !== typeof function(){}) {
					$.error("cyNavigator."+option+" is not a function")
				} else if (option.charAt(0) == '_') {
					$.error("cyNavigator."+option+" is a private function")
				} else {
					data[option].call(data, Array.prototype.slice.call(_arguments, 1))
				}
			}
		})
	}

	$.fn.cytoscapeNavigator.Constructor = Navigator

	$.fn.cytoscapeNavigator.defaults = {
		container: false // can be a HTML or jQuery element or jQuery selector
	, viewLiveFramerate: 0 // set false to update graph pan only on drag end; set 0 to do it instantly; set a number (frames per second) to update not more than N times per second
	, thumbnailEventFramerate: 10 // max thumbnail's updates per second triggered by graph updates
	, thumbnailLiveFramerate: false // max thumbnail's updates per second. Set false to disable
	, dblClickDelay: 200 // milliseconds
	}

	$.fn.cyNavigator = $.fn.cytoscapeNavigator

})(jQuery)
