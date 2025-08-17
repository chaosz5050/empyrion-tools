/**
 * BBCode Parser for Empyrion scenario descriptions
 * Converts Empyrion's BBCode markup to HTML
 */

function parseBBCode(text) {
    if (!text) return '';
    
    let html = text;
    
    // Convert line breaks
    html = html.replace(/\n/g, '<br>');
    
    // Auto-detect plain URLs and make them clickable FIRST (before other parsing)
    // Match common URL patterns but be more specific about boundaries
    html = html.replace(/\b(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<\[\]]*)?/g, function(match) {
        let url = match;
        // Add protocol if missing
        if (!url.match(/^https?:\/\//)) {
            url = 'https://' + url;
        }
        return `<a href="${url}" target="_blank" rel="noopener">${match}</a>`;
    });
    
    // URL tags [url=link]text[/url]
    html = html.replace(/\[url=([^\]]+)\](.*?)\[\/url\]/g, 
        '<a href="$1" target="_blank" rel="noopener">$2</a>');
    
    // Simple URL tags [url]link[/url]
    html = html.replace(/\[url\](.*?)\[\/url\]/g, 
        '<a href="$1" target="_blank" rel="noopener">$1</a>');
    
    // Color tags [c][RRGGBB]text[-][/c]
    html = html.replace(/\[c\]\[([0-9a-fA-F]{6})\](.*?)\[-\]\[\/c\]/g, 
        '<span style="color: #$1;">$2</span>');
    
    // Simple color tags [c][RRGGBB]text[/c] (without [-])
    html = html.replace(/\[c\]\[([0-9a-fA-F]{6})\](.*?)\[\/c\]/g, 
        '<span style="color: #$1;">$2</span>');
    
    // Bold tags [b]text[/b]
    html = html.replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>');
    
    // Italic tags [i]text[/i]
    html = html.replace(/\[i\](.*?)\[\/i\]/g, '<em>$1</em>');
    
    // Underline tags [u]text[/u]
    html = html.replace(/\[u\](.*?)\[\/u\]/g, '<u>$1</u>');
    
    // Superscript tags [sup]text[/sup]
    html = html.replace(/\[sup\](.*?)\[\/sup\]/g, '<sup>$1</sup>');
    
    // Subscript tags [sub]text[/sub]
    html = html.replace(/\[sub\](.*?)\[\/sub\]/g, '<sub>$1</sub>');
    
    // Size tags [size=X]text[/size]
    html = html.replace(/\[size=(\d+)\](.*?)\[\/size\]/g, 
        '<span style="font-size: $1px;">$2</span>');
    
    // Center tags [center]text[/center]
    html = html.replace(/\[center\](.*?)\[\/center\]/g, 
        '<div style="text-align: center;">$1</div>');
    
    // Quote tags [quote]text[/quote]
    html = html.replace(/\[quote\](.*?)\[\/quote\]/gs, 
        '<blockquote style="border-left: 3px solid var(--accent-blue); padding-left: 12px; margin: 8px 0; font-style: italic;">$1</blockquote>');
    
    // Code tags [code]text[/code]
    html = html.replace(/\[code\](.*?)\[\/code\]/gs, 
        '<code style="background: var(--bg-tertiary); padding: 2px 4px; border-radius: 3px; font-family: monospace;">$1</code>');
    
    // List tags [list]...[/list] with [*] items
    html = html.replace(/\[list\](.*?)\[\/list\]/gs, function(match, content) {
        const items = content.split(/\[\*\]/).filter(item => item.trim());
        const listItems = items.map(item => `<li>${item.trim()}</li>`).join('');
        return `<ul style="margin: 8px 0; padding-left: 20px;">${listItems}</ul>`;
    });
    
    // Handle remaining color reset tags [-]
    html = html.replace(/\[-\]/g, '');
    
    // Clean up extra whitespace
    html = html.replace(/\s+/g, ' ').trim();
    
    return html;
}

// Apply BBCode parsing to description when scenario loads
function formatScenarioDescription(description) {
    return parseBBCode(description);
}