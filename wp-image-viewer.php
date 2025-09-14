<?php
/**
 * Plugin Name: WP Image Viewer
 * Plugin URI: https://github.com/MightZero/WP-Image-Viewer
 * Description: A powerful WordPress image viewer plugin with zoom, drag and fullscreen capabilities
 * Version: 1.0.2
 * Author: MightZero
 * License: GPL v2 or later
 * Text Domain: wp-image-viewer
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('WP_IMAGE_VIEWER_VERSION', '1.0.2');
define('WP_IMAGE_VIEWER_PLUGIN_URL', plugin_dir_url(__FILE__));
define('WP_IMAGE_VIEWER_PLUGIN_PATH', plugin_dir_path(__FILE__));

// Main plugin class
class WP_Image_Viewer_Plugin {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('admin_enqueue_scripts', array($this, 'admin_enqueue_scripts'));
        add_shortcode('wp_image_viewer', array($this, 'shortcode_handler'));
        add_action('enqueue_block_editor_assets', array($this, 'enqueue_block_editor_assets'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        add_action('wp_ajax_get_media_library', array($this, 'ajax_get_media_library'));
        add_action('wp_ajax_nopriv_get_media_library', array($this, 'ajax_get_media_library'));
    }
    
    public function init() {
        $lang_dir = dirname(plugin_basename(__FILE__)) . '/languages/';
        // Use WP_PLUGIN_DIR instead of plugin_basename if possible to avoid issues with some server configurations
        if (defined('WP_PLUGIN_DIR') && file_exists(WP_PLUGIN_DIR . '/' . dirname(plugin_basename(__FILE__)) . '/languages/')) {
            $lang_dir = WP_PLUGIN_DIR . '/' . dirname(plugin_basename(__FILE__)) . '/languages/';
        }
        
        load_plugin_textdomain('wp-image-viewer', false, $lang_dir);
    }
    
    public function enqueue_scripts() {
        wp_enqueue_style(
            'wp-image-viewer-style',
            WP_IMAGE_VIEWER_PLUGIN_URL . 'assets/css/wp-image-viewer.css',
            array(),
            WP_IMAGE_VIEWER_VERSION
        );
        
        wp_enqueue_script(
            'wp-image-viewer-script',
            WP_IMAGE_VIEWER_PLUGIN_URL . 'assets/js/wp-image-viewer.js',
            array('jquery'),
            WP_IMAGE_VIEWER_VERSION,
            true
        );
        
        // Load media library in admin interface
        if (is_admin()) {
            wp_enqueue_media();
        }
        
        wp_localize_script('wp-image-viewer-script', 'wpImageViewerAjax', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('wp_image_viewer_nonce')
        ));
    }
    
    public function admin_enqueue_scripts($hook) {
        if ($hook == 'post.php' || $hook == 'post-new.php') {
            $this->enqueue_scripts();
        }
    }
    
    public function enqueue_block_editor_assets() {
        wp_enqueue_script(
            'wp-image-viewer-block',
            WP_IMAGE_VIEWER_PLUGIN_URL . 'assets/js/wp-image-viewer-block.js',
            array('wp-blocks', 'wp-element', 'wp-editor', 'wp-components'),
            WP_IMAGE_VIEWER_VERSION
        );
    }
    
    public function shortcode_handler($atts) {
        $atts = shortcode_atts(array(
            'image_url' => '',
            'image_id' => '',
            'width' => '800px',
            'height' => '600px',
            'min_zoom' => '0.1',
            'max_zoom' => '5',
            'zoom_step' => '0.1',
            'show_media_button' => 'true'
        ), $atts);
        
        $unique_id = 'wp-image-viewer-' . uniqid();
        
        // If image_id is provided, get the image URL
        if (!empty($atts['image_id']) && empty($atts['image_url'])) {
            $atts['image_url'] = wp_get_attachment_url($atts['image_id']);
        }
        
        ob_start();
        ?>
        <div class="wp-image-viewer" id="<?php echo esc_attr($unique_id); ?>" 
             data-min-zoom="<?php echo esc_attr($atts['min_zoom']); ?>"
             data-max-zoom="<?php echo esc_attr($atts['max_zoom']); ?>"
             style="max-width: <?php echo esc_attr($atts['width']); ?>; height: <?php echo esc_attr($atts['height']); ?>;">
            
            <?php if ($atts['show_media_button'] === 'true' && is_admin()): ?>
            <div class="media-selector">
                <button class="button button-primary select-media-btn" data-target="<?php echo esc_attr($unique_id); ?>">
                    <?php esc_html_e('选择图片', 'wp-image-viewer'); ?>
                </button>
            </div>
            <?php endif; ?>
            
            <div class="loading" style="display: none;"><?php esc_html_e('图片加载中...', 'wp-image-viewer'); ?></div>
            <div class="zoom-info">100%</div>
            <div class="image-container">
                <?php if (!empty($atts['image_url'])): ?>
                <img class="viewer-image" src="<?php echo esc_url($atts['image_url']); ?>" alt="<?php esc_attr_e('查看图片', 'wp-image-viewer'); ?>">
                <?php else: ?>
                <div class="no-image"><?php esc_html_e('暂无图片', 'wp-image-viewer'); ?></div>
                <?php endif; ?>
            </div>
            <div class="controls">
                <button class="control-btn zoom-in-btn" title="<?php esc_attr_e('放大', 'wp-image-viewer'); ?>">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                    </svg>
                </button>
                <button class="control-btn zoom-out-btn" title="<?php esc_attr_e('缩小', 'wp-image-viewer'); ?>">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13H5v-2h14v2z"/>
                    </svg>
                </button>
                <button class="control-btn reset-btn" title="<?php esc_attr_e('重置', 'wp-image-viewer'); ?>">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                    </svg>
                </button>
                <button class="control-btn fullscreen-btn" title="<?php esc_attr_e('全屏', 'wp-image-viewer'); ?>">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
                    </svg>
                </button>
            </div>
        </div>
        
        <script>
        jQuery(document).ready(function($) {
            if (typeof WPImageViewer !== 'undefined') {
                new WPImageViewer({
                    containerId: '<?php echo esc_js($unique_id); ?>',
                    imageUrl: '<?php echo esc_js($atts['image_url']); ?>',
                    minZoom: <?php echo is_numeric($atts['min_zoom']) && $atts['min_zoom'] > 0 ? floatval($atts['min_zoom']) : 0.1; ?>,
                    maxZoom: <?php echo is_numeric($atts['max_zoom']) && $atts['max_zoom'] > 0.1 ? floatval($atts['max_zoom']) : 5; ?>,
                    zoomStep: <?php echo is_numeric($atts['zoom_step']) && $atts['zoom_step'] > 0 ? floatval($atts['zoom_step']) : 0.1; ?>
                });
            }
        });
        </script>
        <?php
        return ob_get_clean();
    }
    
    public function activate() {
        flush_rewrite_rules();
    }
    
    public function deactivate() {
        flush_rewrite_rules();
    }
    
    public function ajax_get_media_library() {
        check_ajax_referer('wp_image_viewer_nonce', 'nonce');
        
        $images = get_posts(array(
            'post_type' => 'attachment',
            'post_mime_type' => 'image',
            'numberposts' => 20,
            'post_status' => 'inherit'
        ));
        
        $result = array();
        foreach ($images as $image) {
            $result[] = array(
                'id' => $image->ID,
                'url' => wp_get_attachment_url($image->ID),
                'title' => $image->post_title,
                'thumb' => wp_get_attachment_thumb_url($image->ID)
            );
        }
        
        wp_send_json_success($result);
    }
}

// Initialize plugin
new WP_Image_Viewer_Plugin();

// Add settings page
add_action('admin_menu', 'wp_image_viewer_admin_menu');

function wp_image_viewer_admin_menu() {
    add_options_page(
        __('WP Image Viewer Settings', 'wp-image-viewer'),
        __('Image Viewer', 'wp-image-viewer'),
        'manage_options',
        'wp-image-viewer',
        'wp_image_viewer_settings_page'
    );
}

function wp_image_viewer_settings_page() {
    if (isset($_POST['submit'])) {
        update_option('wp_image_viewer_default_width', sanitize_text_field($_POST['default_width']));
        update_option('wp_image_viewer_default_height', sanitize_text_field($_POST['default_height']));
        echo '<div class="notice notice-success"><p>' . esc_html__('设置已保存！', 'wp-image-viewer') . '</p></div>';
    }
    
    $default_width = get_option('wp_image_viewer_default_width', '800px');
    $default_height = get_option('wp_image_viewer_default_height', '600px');
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('WP Image Viewer 设置', 'wp-image-viewer'); ?></h1>
        <form method="post">
            <table class="form-table">
                <tr>
                    <th scope="row"><?php esc_html_e('默认宽度', 'wp-image-viewer'); ?></th>
                    <td><input type="text" name="default_width" value="<?php echo esc_attr($default_width); ?>" /></td>
                </tr>
                <tr>
                    <th scope="row"><?php esc_html_e('默认高度', 'wp-image-viewer'); ?></th>
                    <td><input type="text" name="default_height" value="<?php echo esc_attr($default_height); ?>" /></td>
                </tr>
            </table>
            <?php submit_button(__('保存设置', 'wp-image-viewer')); ?>
        </form>
        
        <h2><?php esc_html_e('使用方法', 'wp-image-viewer'); ?></h2>
        <p><?php esc_html_e('使用短代码：', 'wp-image-viewer'); ?><code>[wp_image_viewer image_url="图片URL"]</code></p>
        <p><?php esc_html_e('或使用媒体库：', 'wp-image-viewer'); ?><code>[wp_image_viewer image_id="123"]</code></p>
        <p><?php esc_html_e('可选参数：', 'wp-image-viewer'); ?></p>
        <ul>
            <li><code>width</code> - <?php esc_html_e('查看器宽度', 'wp-image-viewer'); ?></li>
            <li><code>height</code> - <?php esc_html_e('查看器高度', 'wp-image-viewer'); ?></li>
            <li><code>min_zoom</code> - <?php esc_html_e('最小缩放比例', 'wp-image-viewer'); ?></li>
            <li><code>max_zoom</code> - <?php esc_html_e('最大缩放比例', 'wp-image-viewer'); ?></li>
            <li><code>zoom_step</code> - <?php esc_html_e('缩放步长', 'wp-image-viewer'); ?></li>
            <li><code>show_media_button</code> - <?php esc_html_e('是否显示媒体选择按钮', 'wp-image-viewer'); ?></li>
        </ul>
    </div>
    <?php
}