(function($) {
    'use strict';

    window.WPImageViewer = function(options) {
        this.options = $.extend({
            containerId: 'imageViewer',
            imageUrl: '',
            minZoom: 0.1,
            maxZoom: 5,
            zoomStep: 0.1,
            wheelSensitivity: 0.002
        }, options);

        this.container = $('#' + this.options.containerId);
        this.imageContainer = this.container.find('.image-container');
        this.image = this.container.find('.viewer-image');
        this.loading = this.container.find('.loading');
        this.zoomInfo = this.container.find('.zoom-info');
        
        // Transform state
        this.transform = {
            x: 0,
            y: 0,
            scale: 1
        };
        
        // Interaction state
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragLastTransform = { x: 0, y: 0 };
        this.dragUpdatePending = false;
        
        // Touch state
        this.touchState = {
            fingers: 0,
            startDistance: 0,
            startScale: 1,
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            centerX: 0,
            centerY: 0,
            // 新增：保存起始时的变换，用于以该变换为基准计算缩放和平移
            baseTransform: { x: 0, y: 0, scale: 1 },
            // 新增：保存起始时以 baseTransform 计算得到的图片坐标中心（缩放锚点）
            baseCenterImagePoint: { x: 0, y: 0 }
        };

        // Latest coordinates
        this.latestCoords = { x: 0, y: 0 };

        this.init();
    };

    WPImageViewer.prototype = {
        init: function() {
            this.bindEvents();
            this.preventContextMenu();
            if (this.options.imageUrl) {
                this.loadImage(this.options.imageUrl);
            }
            this.initMediaSelector();
            this.updateTransform();
        },

        preventContextMenu: function() {
            this.image.on('contextmenu dragstart', function(e) {
                e.preventDefault();
                return false;
            });
            
            this.container.on('selectstart', function(e) {
                e.preventDefault();
            });
        },

        initMediaSelector: function() {
            var self = this;
            var $selectBtn = this.container.find('.select-media-btn');
            
            $selectBtn.on('click', function(e) {
                e.preventDefault();
                
                if (typeof wp !== 'undefined' && wp.media) {
                    var frame = wp.media({
                        title: wp.i18n.__('Select Image', 'wp-image-viewer'),
                        button: { text: wp.i18n.__('Select', 'wp-image-viewer') },
                        multiple: false,
                        library: { type: 'image' }
                    });

                    frame.on('select', function() {
                        var attachment = frame.state().get('selection').first().toJSON();
                        self.loadImage(attachment.url);
                    });

                    frame.open();
                }
            });
        },

        // Get container center coordinates
        getContainerCenter: function() {
            var containerEl = this.imageContainer[0];
            return {
                x: containerEl.clientWidth / 2,
                y: containerEl.clientHeight / 2
            };
        },

        // Convert screen coordinates to image-centered coordinates (used for zooming only)
        screenToImageCenter: function(screenX, screenY) {
            var containerEl = this.imageContainer[0];
            var rect = containerEl.getBoundingClientRect();
            var containerCenter = this.getContainerCenter();

            // Calculate container-relative coordinates
            var containerX = screenX - rect.left;
            var containerY = screenY - rect.top;

            // Calculate coordinates with container center as origin
            var centerBasedX = containerX - containerCenter.x;
            var centerBasedY = containerY - containerCenter.y;

            return {
                x: centerBasedX - this.transform.x,
                y: centerBasedY - this.transform.y
            };
        },

        // 新增：在任意给定 transform 下，把屏幕坐标转换为以容器中心为原点并减去 transform 的图片坐标
        screenToImageCenterForTransform: function(screenX, screenY, transform) {
            var containerEl = this.imageContainer[0];
            var rect = containerEl.getBoundingClientRect();
            var containerCenter = this.getContainerCenter();

            var containerX = screenX - rect.left;
            var containerY = screenY - rect.top;

            var centerBasedX = containerX - containerCenter.x;
            var centerBasedY = containerY - containerCenter.y;

            // 使用传入的 transform（通常是 baseTransform）
            return {
                x: centerBasedX - transform.x,
                y: centerBasedY - transform.y
            };
        },

        // Logarithmic scale conversion functions
        scaleToLog: function(scale) {
            return Math.log(Math.max(scale, 0.001));
        },

        logToScale: function(logValue) {
            return Math.exp(logValue);
        },

        // Limit scale values
        clampScale: function(scale) {
            var clamped = Math.max(this.options.minZoom, Math.min(this.options.maxZoom, scale));
            return clamped;
        },

        // Calculate distance between two points
        getDistance: function(coords1, coords2) {
            var dx = coords1.x - coords2.x;
            var dy = coords1.y - coords2.y;
            return Math.sqrt(dx * dx + dy * dy);
        },

        // Calculate center point between two points
        getCenter: function(coords1, coords2) {
            return {
                x: (coords1.x + coords2.x) / 2,
                y: (coords1.y + coords2.y) / 2
            };
        },

        bindEvents: function() {
            var self = this;

            // Mouse events
            this.imageContainer[0].addEventListener('mousedown', function(e) {
                if (!self.isZooming) {
                    e.preventDefault();
                    self.startDrag(e.clientX, e.clientY);
                }
            });

            $(document).on('mousemove', function(e) {
                if (self.isDragging) {
                    e.preventDefault();
                    self.latestCoords = { x: e.clientX, y: e.clientY };
                    self.queueDragUpdate();
                }
            });

            $(document).on('mouseup', function() {
                self.stopDrag();
            });

            // Wheel zoom
            this.imageContainer[0].addEventListener('wheel', function(e) {
                e.preventDefault();
                
                var coords = self.screenToImageCenter(e.clientX, e.clientY);
                var delta = e.deltaY;
                
                // Logarithmic scale zoom
                var currentLogScale = self.scaleToLog(self.transform.scale);
                var logDelta = -delta * self.options.wheelSensitivity;
                var newLogScale = currentLogScale + logDelta;
                var newScale = self.clampScale(self.logToScale(newLogScale));
                var scaleFactor = newScale / self.transform.scale;
                
                if (Math.abs(scaleFactor - 1) > 0.001) {
                    self.zoomAtImagePoint(coords, scaleFactor);
                }
            });

            // Touch events - Improved touch handling for better responsiveness
            this.imageContainer[0].addEventListener('touchstart', function(e) {
                e.preventDefault();
                
                var touches = e.touches;
                self.touchState.fingers = touches.length;
                
                if (touches.length === 1) {
                    // Single finger touch - drag operation
                    self.touchState.startX = touches[0].clientX;
                    self.touchState.startY = touches[0].clientY;
                    self.touchState.lastX = touches[0].clientX;
                    self.touchState.lastY = touches[0].clientY;
                    self.startDrag(touches[0].clientX, touches[0].clientY);
                } else if (touches.length === 2) {
                    // Two finger touch - zoom operation
                    self.stopDrag();
                    
                    var coords1 = {
                        x: touches[0].clientX,
                        y: touches[0].clientY
                    };
                    
                    var coords2 = {
                        x: touches[1].clientX,
                        y: touches[1].clientY
                    };
                    
                    // 保存起始手势距离与缩放
                    self.touchState.startDistance = self.getDistance(coords1, coords2);
                    self.touchState.startScale = self.transform.scale;

                    // 保存起始变换（baseTransform），以其为基准计算后续的缩放与位移
                    self.touchState.baseTransform = {
                        x: self.transform.x,
                        y: self.transform.y,
                        scale: self.transform.scale
                    };
                    
                    // 计算当前两指中心（屏幕坐标）
                    var center = self.getCenter(coords1, coords2);
                    self.touchState.centerX = center.x;
                    self.touchState.centerY = center.y;

                    // 计算并保存以 baseTransform 为基准时，两指中心对应的“图片坐标”
                    self.touchState.baseCenterImagePoint = self.screenToImageCenterForTransform(center.x, center.y, self.touchState.baseTransform);
                }
            }, { passive: false });

            this.imageContainer[0].addEventListener('touchmove', function(e) {
                e.preventDefault();
                
                var touches = e.touches;
                
                if (touches.length === 1 && self.isDragging) {
                    // Single finger drag
                    self.touchState.lastX = touches[0].clientX;
                    self.touchState.lastY = touches[0].clientY;
                    self.drag(touches[0].clientX, touches[0].clientY);
                } else if (touches.length === 2) {
                    // Two finger zoom
                    var coords1 = {
                        x: touches[0].clientX,
                        y: touches[0].clientY
                    };
                    
                    var coords2 = {
                        x: touches[1].clientX,
                        y: touches[1].clientY
                    };
                    
                    var currentDistance = self.getDistance(coords1, coords2);

                    // 防止除以 0
                    if (!self.touchState.startDistance || self.touchState.startDistance <= 0) {
                        self.touchState.startDistance = currentDistance || 1;
                    }

                    // 目标缩放（以 startScale 为基准）
                    var targetScale = self.touchState.startScale * (currentDistance / self.touchState.startDistance);
                    targetScale = self.clampScale(targetScale);

                    // 计算实际的 scaleFactor（相对于 baseTransform.scale）
                    var scaleFactor = targetScale / self.touchState.baseTransform.scale;

                    // 重新计算当前两指中心（屏幕坐标）
                    var center = self.getCenter(coords1, coords2);

                    // 计算以 baseTransform 为基准时，当前中心对应的图片坐标（这样平移会把当前手势中心与图片上的同一点对齐）
                    var currentCenterImagePoint = self.screenToImageCenterForTransform(center.x, center.y, self.touchState.baseTransform);

                    // 使用基准变换 + 以基准图片坐标为锚点进行缩放和平移（确保缩放以手指中心为中心）
                    self.zoomAtImagePointWithScale(currentCenterImagePoint, scaleFactor, self.touchState.baseTransform);
                }
            }, { passive: false });

            this.imageContainer[0].addEventListener('touchend', function(e) {
                var touches = e.touches;
                self.touchState.fingers = touches.length;
                
                if (touches.length === 0) {
                    self.stopDrag();
                    // 清理 touchState 中的一些临时数据
                    self.touchState.startDistance = 0;
                    self.touchState.startScale = self.transform.scale;
                } else if (touches.length === 1) {
                    // Switch to single finger drag
                    // 注意：touches 是当前事件中的 active touches（长度为1），延时让事件稳定
                    setTimeout(function() {
                        // 若 touches 在这个闭包中被更新而不可用，改为使用 touchend 事件中的 changedTouches 通常更准确，
                        // 但为保持和原逻辑一致，这里尽量沿用原代码的行为。
                        // 仍然检查当前文档的触摸点（更稳健）
                        var activeTouch = null;
                        // 尝试从 event 的 touches 中获取（不可靠），所以另外从 document 上寻找
                        // 这里直接使用 window 的触摸点可能不可行；但在常规移动浏览器中，setTimeout 之后 touches[0] 通常仍然有效
                        if (touches[0]) {
                            activeTouch = touches[0];
                        }
                        if (activeTouch) {
                            self.touchState.startX = activeTouch.clientX;
                            self.touchState.startY = activeTouch.clientY;
                            self.touchState.lastX = activeTouch.clientX;
                            self.touchState.lastY = activeTouch.clientY;
                            self.startDrag(activeTouch.clientX, activeTouch.clientY);
                        }
                    }, 10);
                }
            }, { passive: false });

            // Button events
            this.container.find('.zoom-in-btn').on('click', function(e) {
                e.preventDefault();
                var currentLogScale = self.scaleToLog(self.transform.scale);
                var logStep = self.scaleToLog(1 + self.options.zoomStep);
                var newScale = self.clampScale(self.logToScale(currentLogScale + logStep));
                var scaleFactor = newScale / self.transform.scale;
                self.zoomAtImagePoint({x: 0, y: 0}, scaleFactor);
            });

            this.container.find('.zoom-out-btn').on('click', function(e) {
                e.preventDefault();
                var currentLogScale = self.scaleToLog(self.transform.scale);
                var logStep = self.scaleToLog(1 + self.options.zoomStep);
                var newScale = self.clampScale(self.logToScale(currentLogScale - logStep));
                var scaleFactor = newScale / self.transform.scale;
                self.zoomAtImagePoint({x: 0, y: 0}, scaleFactor);
            });

            this.container.find('.reset-btn').on('click', function(e) {
                e.preventDefault();
                self.reset();
            });

            this.container.find('.fullscreen-btn').on('click', function(e) {
                e.preventDefault();
                self.toggleFullscreen();
            });

            // Disable right-click menu
            this.imageContainer.on('contextmenu', function(e) {
                e.preventDefault();
            });
        },

        // Use requestAnimationFrame to queue drag updates
        queueDragUpdate: function() {
            var self = this;
            
            if (!this.dragUpdatePending) {
                this.dragUpdatePending = true;
                requestAnimationFrame(function() {
                    self.drag(self.latestCoords.x, self.latestCoords.y);
                    self.dragUpdatePending = false;
                });
            }
        },

        // Drag handling - use screen coordinates
        drag: function(x, y) {
            if (!this.isDragging) return;

            var deltaX = this.dragStart.x - x;
            var deltaY = this.dragStart.y - y;

            this.transform.x = this.dragLastTransform.x - deltaX;
            this.transform.y = this.dragLastTransform.y - deltaY;

            this.updateTransform();
        },

        startDrag: function(x, y) {
            if (this.isZooming) return;
            
            this.isDragging = true;
            this.dragStart.x = x;
            this.dragStart.y = y;
            this.dragLastTransform.x = this.transform.x;
            this.dragLastTransform.y = this.transform.y;
            
            this.imageContainer.addClass('dragging');
        },

        stopDrag: function() {
            this.isDragging = false;
            this.dragUpdatePending = false;
            this.imageContainer.removeClass('dragging');
        },


        // Zoom at a specific point in image coordinates
        zoomAtImagePoint: function(imagePoint, scaleFactor) {
            var newScale = this.clampScale(this.transform.scale * scaleFactor);
            
            if (Math.abs(newScale - this.transform.scale) < 0.001) return;
            
            var actualScaleFactor = newScale / this.transform.scale;
            this.zoomAtImagePointWithScale(imagePoint, actualScaleFactor, this.transform);
        },

        // Zoom calculation based on a specific base transform state
        zoomAtImagePointWithScale: function(imagePoint, scaleFactor, baseTransform) {
            this.transform.x = baseTransform.x + imagePoint.x * (1 - scaleFactor);
            this.transform.y = baseTransform.y + imagePoint.y * (1 - scaleFactor);
            this.transform.scale = baseTransform.scale * scaleFactor;
            
            this.updateTransform();
        },

        loadImage: function(url) {
            var self = this;
            this.loading.show();
            
            var img = new Image();
            img.onload = function() {
                self.image.attr('src', url);
                self.loading.hide();
                self.reset();
            };
            img.onerror = function() {
                self.loading.hide();
                alert(wp.i18n.__('Image loading failed', 'wp-image-viewer'));
            };
            img.src = url;
        },

        reset: function() {
            this.transform.x = 0;
            this.transform.y = 0;
            this.transform.scale = 1;
            this.stopDrag();
            this.stopTouchZoom && this.stopTouchZoom();
            this.updateTransform();
        },

        updateTransform: function() {
            var transform = 'translate(' + this.transform.x + 'px, ' + this.transform.y + 'px) scale(' + this.transform.scale + ')';
            this.image.css('transform', transform);
            if (this.zoomInfo.length) {
                this.zoomInfo.text(Math.round(this.transform.scale * 100) + '%');
            }
        },

        toggleFullscreen: function() {
            if (!document.fullscreenElement) {
                this.container[0].requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
    };

    $(document).ready(function() {
        $('.wp-image-viewer').each(function() {
            var $container = $(this);
            var containerId = $container.attr('id');
            
            if (containerId) {
                // Read configuration options from data attributes
                var options = {
                    containerId: containerId
                };
                
                // Check for custom zoom limits
                // According to HTML data attribute reading best practices, try multiple ways to read attributes
                var minZoom = $container.data('min-zoom') || $container.attr('data-min-zoom');
                var maxZoom = $container.data('max-zoom') || $container.attr('data-max-zoom');
                
                // Also try camelCase naming
                if (minZoom === undefined) {
                    minZoom = $container.data('minZoom');
                }
                
                if (maxZoom === undefined) {
                    maxZoom = $container.data('maxZoom');
                }
                
                if (minZoom !== undefined && !isNaN(parseFloat(minZoom))) {
                    options.minZoom = parseFloat(minZoom);
                }
                
                if (maxZoom !== undefined && !isNaN(parseFloat(maxZoom))) {
                    options.maxZoom = parseFloat(maxZoom);
                }
                
                new WPImageViewer(options);
            }
        });
    });

})(jQuery);
