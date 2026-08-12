/* Interests rail -> publication curves.
   Measures with offsetTop/offsetLeft rather than getBoundingClientRect, so a
   sticky rail or a mid-scroll redraw can't distort the anchor positions. */

(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MIN_WIDTH = 400;          // below this, curves are not drawn
  var CONTROL_RATIO = 0.5;      // horizontal pull of the bezier handles
  var LAND_SPREAD = 22;         // px spread of landing points on a multi-topic paper

  /* Position of el relative to ancestor, walking the offsetParent chain.
     Unaffected by scroll position or sticky placement. */
  function offsetWithin(el, ancestor) {
    var x = 0, y = 0, node = el;
    while (node && node !== ancestor) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return { x: x, y: y, w: el.offsetWidth, h: el.offsetHeight };
  }

  function setup(root) {
    var canvas = root.querySelector('.pc__curves');
    var status = root.querySelector('[data-pc-status]');
    var clearBtn = root.querySelector('[data-pc-clear]');
    var topics = Array.prototype.slice.call(root.querySelectorAll('.pc__topic'));
    var pubs = Array.prototype.slice.call(root.querySelectorAll('.pc__pub'));
    var edges = [];
    var selected = null;
    var hovered = null;   // paper element under the cursor

    if (getComputedStyle(root).position === 'static') root.style.position = 'relative';

    function topicsOf(pub) {
      return (pub.getAttribute('data-topics') || '').split(/\s+/).filter(Boolean);
    }

    function draw() {
      canvas.innerHTML = '';
      edges = [];

      var width = root.offsetWidth;
      var height = root.offsetHeight;

      if (width < MIN_WIDTH) {
        root.setAttribute('data-curves', 'off');
        return;
      }
      root.setAttribute('data-curves', 'on');

      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'pc__svg');
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      svg.setAttribute('preserveAspectRatio', 'none');
      canvas.appendChild(svg);

      /* The rail is sticky, so its offsetTop reports where it *started*, not
         where it is now. Measure it against the container's live rect instead. */
      var rootRect = root.getBoundingClientRect();
      var anchors = {};
      topics.forEach(function (btn) {
        var r = btn.getBoundingClientRect();
        anchors[btn.getAttribute('data-topic')] = {
          x: r.right - rootRect.left + 6,
          y: r.top - rootRect.top + r.height / 2
        };
      });

      pubs.forEach(function (pub, pubIndex) {
        if (!pub.id) pub.id = 'pc-pub-' + pubIndex;
        var list = topicsOf(pub);
        var o = offsetWithin(pub, root);
        var x2 = o.x - 6;
        var mid = o.y + Math.min(o.h / 2, 44);
        var span = (list.length - 1) * LAND_SPREAD;

        list.forEach(function (slug, i) {
          var a = anchors[slug];
          if (!a) return;
          var y2 = mid - span / 2 + i * LAND_SPREAD;
          var pull = Math.max((x2 - a.x) * CONTROL_RATIO, 30);
          var path = document.createElementNS(SVG_NS, 'path');
          path.setAttribute('d',
            'M ' + a.x + ' ' + a.y +
            ' C ' + (a.x + pull) + ' ' + a.y + ', ' +
                    (x2 - pull) + ' ' + y2 + ', ' + x2 + ' ' + y2);
          path.setAttribute('class', 'pc__edge');
          path.setAttribute('data-topic', slug);
          path.setAttribute('data-pub', pub.id);
          svg.appendChild(path);
          edges.push(path);
        });
      });

      render();
    }

    function render() {
      /* Hover takes visual priority over selection, but doesn't replace it —
         releasing the cursor returns to whatever was selected. */
      var hoverTopics = hovered ? topicsOf(hovered) : null;

      edges.forEach(function (e) {
        var slug = e.getAttribute('data-topic');
        var lit, dim;

        if (hoverTopics) {
          lit = e.getAttribute('data-pub') === hovered.id;
          dim = !lit;
        } else if (selected) {
          lit = slug === selected;
          dim = !lit;
        } else {
          lit = false;
          dim = false;
        }

        e.classList.toggle('is-lit', lit);
        e.classList.toggle('is-dim', dim);
      });

      topics.forEach(function (btn) {
        var slug = btn.getAttribute('data-topic');
        var isSel = selected === slug;
        var isHovered = hoverTopics && hoverTopics.indexOf(slug) > -1;

        btn.setAttribute('aria-pressed', isSel ? 'true' : 'false');
        btn.classList.toggle('is-active', isSel || Boolean(isHovered));
        btn.classList.toggle('is-dim',
          (hoverTopics && !isHovered) || (!hoverTopics && Boolean(selected) && !isSel));
      });

      var shown = 0;
      pubs.forEach(function (pub) {
        var on = !selected || topicsOf(pub).indexOf(selected) > -1;
        pub.classList.toggle('is-dim', !on);
        pub.classList.toggle('is-hovered', pub === hovered);
        if (on) shown++;
      });

      status.textContent = shown + (shown === 1 ? ' paper' : ' papers');
      if (clearBtn) clearBtn.hidden = !selected;
    }

    topics.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var slug = btn.getAttribute('data-topic');
        selected = (selected === slug) ? null : slug;
        render();
      });
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        selected = null;
        render();
        if (topics[0]) topics[0].focus();
      });
    }

    pubs.forEach(function (pub) {
      pub.addEventListener('mouseenter', function () { hovered = pub; render(); });
      pub.addEventListener('mouseleave', function () { hovered = null; render(); });
      /* Keyboard users get the same effect when a link inside gains focus. */
      pub.addEventListener('focusin', function () { hovered = pub; render(); });
      pub.addEventListener('focusout', function () { hovered = null; render(); });
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && selected) { selected = null; render(); }
    });

    draw();

    var pending;
    function schedule() {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(draw);
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(schedule).observe(root);
    } else {
      window.addEventListener('resize', schedule);
    }

    Array.prototype.forEach.call(root.querySelectorAll('img'), function (img) {
      if (!img.complete) img.addEventListener('load', schedule, { once: true });
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    window.addEventListener('load', schedule);

    /* Sticky rail means anchor positions change with scroll. rAF-throttled. */
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { draw(); ticking = false; });
    }, { passive: true });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-pc]'), setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
