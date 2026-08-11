/* Interests rail -> publication curves.
   Measures the laid-out DOM, draws one SVG path per (topic, paper) pair,
   redraws on resize, and degrades to a plain filter list on narrow screens. */

(function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MIN_WIDTH = 900;          // below this, curves are not drawn
  var CONTROL_RATIO = 0.5;      // horizontal pull of the bezier handles
  var LAND_SPREAD = 26;         // px spread of landing points on a multi-topic paper

  function setup(root) {
    var rail = root.querySelector('.pc__rail');
    var canvas = root.querySelector('.pc__curves');
    var status = root.querySelector('[data-pc-status]');
    var clearBtn = root.querySelector('[data-pc-clear]');
    var topics = Array.prototype.slice.call(root.querySelectorAll('.pc__topic'));
    var pubs = Array.prototype.slice.call(root.querySelectorAll('.pc__pub'));
    var svg = null;
    var edges = [];
    var selected = null;

    function topicsOf(pub) {
      return (pub.getAttribute('data-topics') || '').split(/\s+/).filter(Boolean);
    }

    function draw() {
      canvas.innerHTML = '';
      edges = [];

      if (root.clientWidth < MIN_WIDTH) {
        root.setAttribute('data-curves', 'off');
        return;
      }
      root.setAttribute('data-curves', 'on');

      var box = root.getBoundingClientRect();
      svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'pc__svg');
      svg.setAttribute('width', box.width);
      svg.setAttribute('height', root.scrollHeight);
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + root.scrollHeight);
      canvas.appendChild(svg);

      var anchors = {};
      topics.forEach(function (btn) {
        var r = btn.getBoundingClientRect();
        anchors[btn.getAttribute('data-topic')] = {
          x: r.right - box.left + 6,
          y: r.top - box.top + r.height / 2
        };
      });

      pubs.forEach(function (pub) {
        var list = topicsOf(pub);
        var r = pub.getBoundingClientRect();
        var x2 = r.left - box.left - 6;
        var mid = r.top - box.top + Math.min(r.height / 2, 48);
        var span = (list.length - 1) * LAND_SPREAD;

        list.forEach(function (slug, i) {
          var a = anchors[slug];
          if (!a) return;
          var y2 = mid - span / 2 + i * LAND_SPREAD;
          var pull = (x2 - a.x) * CONTROL_RATIO;
          var path = document.createElementNS(SVG_NS, 'path');
          path.setAttribute('d',
            'M ' + a.x + ' ' + a.y +
            ' C ' + (a.x + pull) + ' ' + a.y + ', ' + (x2 - pull) + ' ' + y2 + ', ' + x2 + ' ' + y2);
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
      clearBtn.hidden = !selected;
    }

    function select(slug) {
      selected = (selected === slug) ? null : slug;
      render();
    }

    topics.forEach(function (btn) {
      btn.addEventListener('click', function () { select(btn.getAttribute('data-topic')); });
    });

    clearBtn.addEventListener('click', function () {
      selected = null;
      render();
      if (topics[0]) topics[0].focus();
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

    // Teasers change block heights as they load, which moves the landing points.
    root.querySelectorAll('img').forEach(function (img) {
      if (!img.complete) img.addEventListener('load', schedule, { once: true });
    });

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  }

  function init() {
    document.querySelectorAll('[data-pc]').forEach(setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
