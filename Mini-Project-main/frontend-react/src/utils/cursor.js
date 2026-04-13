// CUSTOM CURSOR EFFECT
export function initCursor() {
    const cur = document.getElementById('cur');
    const curDot = document.getElementById('cur-dot');
    let mx = 0, my = 0, cx = 0, cy = 0;

    document.addEventListener('mousemove', e => { 
        mx = e.clientX; 
        my = e.clientY; 
    });

    (function moveCursor() {
        cx += (mx - cx) * .08; 
        cy += (my - cy) * .08;
        cur.style.left = cx + 'px'; 
        cur.style.top = cy + 'px';
        curDot.style.left = mx + 'px'; 
        curDot.style.top = my + 'px';
        requestAnimationFrame(moveCursor);
    })();
}
