<?php
if (!defined('ABSPATH')) {
    exit;
}

$post_id = isset($_REQUEST['post_id']) ? absint($_REQUEST['post_id']) : 0;

wp_enqueue_media(array(
    'post' => $post_id,
));
?>

<style>
    .media-modal-content {
        height: 80%;
    }
</style>

<div class="media-modal wp-core-ui">
    <button type="button" class="media-modal-close"><span class="media-modal-icon"><span class="screen-reader-text"><?php esc_html_e('关闭对话框', 'wp-image-viewer'); ?></span></span></button>
    <div class="media-modal-content">
        <div class="media-frame mode-select">
            <div class="media-frame-title">
                <h1><?php esc_html_e('Select Image', 'wp-image-viewer'); ?></h1>
            </div>
            <div class="media-frame-content">
                <div class="uploader-inline">
                    <?php media_upload_form('type=image&tab=library&post_id=' . $post_id . '&context=wp-image-viewer'); ?>
                </div>
            </div>
            <div class="media-frame-toolbar">
                <div class="media-toolbar">
                    <div class="media-toolbar-primary search-form">
                        <button type="button" class="button media-button button-primary button-large media-button-select"><?php esc_html_e('Select Image', 'wp-image-viewer'); ?></button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    jQuery(document).ready(function($) {
        var frame;
        var $container = $('.wp-image-viewer-shortcode');

        $('.media-button-select').on('click', function(e) {
            e.preventDefault();

            if (frame) {
                frame.open();
                return;
            }

            frame = wp.media({
                title: wp.i18n.__('Select Image', 'wp-image-viewer'),
                button: {
                    text: wp.i18n.__('Select', 'wp-image-viewer')
                },
                multiple: false
            });

            frame.on('select', function() {
                var attachment = frame.state().get('selection').first().toJSON();
                $container.data('image-url', attachment.url);
                $container.trigger('image-selected', [attachment]);
                frame.close();
            });

            frame.open();
        });
    });
</script>