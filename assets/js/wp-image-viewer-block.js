(function(blocks, element, editor, components, i18n) {
    var el = element.createElement;
    var __ = i18n.__;
    var _x = i18n._x;
    var TextControl = components.TextControl;
    var Button = components.Button;
    var MediaUpload = editor.MediaUpload;
    var InspectorControls = editor.InspectorControls;

    blocks.registerBlockType('wp-image-viewer/image-viewer', {
        title: __('WP Image Viewer', 'wp-image-viewer'),
        icon: 'format-image',
        category: 'media',
        attributes: {
            imageId: {
                type: 'number'
            },
            imageUrl: {
                type: 'string',
                default: ''
            },
            width: {
                type: 'string',
                default: '800px'
            },
            height: {
                type: 'string',
                default: '600px'
            },
            minZoom: {
                type: 'number',
                default: 0.1
            },
            maxZoom: {
                type: 'number',
                default: 5
            }
        },

        edit: function(props) {
            var attributes = props.attributes;
            var setAttributes = props.setAttributes;

            function onSelectImage(media) {
                setAttributes({
                    imageId: media.id,
                    imageUrl: media.url
                });
            }

            function onRemoveImage() {
                setAttributes({
                    imageId: undefined,
                    imageUrl: ''
                });
            }

            return [
                el(InspectorControls, {key: 'inspector'},
                    el(components.PanelBody, {title: __('Image Settings', 'wp-image-viewer'), initialOpen: true},
                        el(MediaUpload, {
                            onSelect: onSelectImage,
                            type: 'image',
                            value: attributes.imageId,
                            render: function(obj) {
                                return el(Button, {
                                    className: attributes.imageId ? 'image-button' : 'button button-large',
                                    onClick: obj.open
                                }, !attributes.imageId ? __('Select Image', 'wp-image-viewer') : __('Change Image', 'wp-image-viewer'));
                            }
                        }),
                        attributes.imageId && el(Button, {
                            className: 'button-link-delete',
                            onClick: onRemoveImage
                        }, __('Remove Image', 'wp-image-viewer'))
                    ),
                    el(components.PanelBody, {title: __('Display Settings', 'wp-image-viewer')},
                        el(TextControl, {
                            label: __('Width', 'wp-image-viewer'),
                            value: attributes.width,
                            onChange: function(value) {
                                setAttributes({width: value});
                            }
                        }),
                        el(TextControl, {
                            label: __('Height', 'wp-image-viewer'),
                            value: attributes.height,
                            onChange: function(value) {
                                setAttributes({height: value});
                            }
                        }),
                        el(TextControl, {
                            label: __('Minimum Zoom Level', 'wp-image-viewer'),
                            type: 'number',
                            value: attributes.minZoom,
                            onChange: function(value) {
                                setAttributes({minZoom: parseFloat(value) || 0.1});
                            }
                        }),
                        el(TextControl, {
                            label: __('Maximum Zoom Level', 'wp-image-viewer'),
                            type: 'number',
                            value: attributes.maxZoom,
                            onChange: function(value) {
                                setAttributes({maxZoom: parseFloat(value) || 5});
                            }
                        })
                    )
                ),
                el('div', {className: 'wp-image-viewer-placeholder'},
                    attributes.imageUrl ?
                        el('img', {src: attributes.imageUrl, style: {maxWidth: '100%', height: 'auto'}}) :
                        el('div', {className: 'placeholder-text'}, __('Select an image to display in the image viewer', 'wp-image-viewer'))
                )
            ];
        },

        save: function(props) {
            var attributes = props.attributes;
            return el('div', {
                'data-image-id': attributes.imageId,
                'data-image-url': attributes.imageUrl,
                'data-width': attributes.width,
                'data-height': attributes.height,
                'data-min-zoom': attributes.minZoom,
                'data-max-zoom': attributes.maxZoom,
                className: 'wp-image-viewer-block'
            }, '[wp_image_viewer image_id="' + attributes.imageId + '" width="' + attributes.width + '" height="' + attributes.height + '" min_zoom="' + attributes.minZoom + '" max_zoom="' + attributes.maxZoom + '"]');
        }
    });

})(window.wp.blocks, window.wp.element, window.wp.editor, window.wp.components, window.wp.i18n);