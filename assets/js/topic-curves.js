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

      var anchors = {};
      topics.forEach(function (btn) {
        var o = offsetWithin(btn, root);
        anchors[btn.getAttribute('data-topic')] = {
          x: o.x + o.w + 6,
          y: o.y + o.h / 2
        };
      });

      pubs.forEach(function (pub) {
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
          svg.appendChild(path);
          edges.push(path);
        });
      });

      render();
    }

    function render() {
      edges.forEach(function (e) {
        var on = !selected || e.getAttribute('data-topic') === selected;
        e.classList.toggle('is-lit', Boolean(selected) && on);
        e.classList.toggle('is-dim', Boolean(selected) && !on);
      });

      topics.forEach(function (btn) {
        var isSel = selected === btn.getAttribute('data-topic');
        btn.setAttribute('aria-pressed', isSel ? 'true' : 'false');
        btn.classList.toggle('is-active', isSel);
        btn.classList.toggle('is-dim', Boolean(selected) && !isSel);
      });

      var shown = 0;
      pubs.forEach(function (pub) {
        var on = !selected || topicsOf(pub).indexOf(selected) > -1;
        pub.classList.toggle('is-dim', !on);
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
/* The theme's width constraints are winning. Override them wherever the
   component actually appears, regardless of body classes. */
.page:has(.pc),
.page__inner-wrap:has(.pc) {
  width: 100% !important;
  max-width: 100% !important;
  padding-right: 0 !important;
  padding-left: 0 !important;
  float: none !important;
}

#main:has(.pc) { max-width: 1200px; }
