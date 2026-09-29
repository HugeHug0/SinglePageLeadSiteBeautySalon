/* ==========================================================================
   Terata — beauty & spa
   Лёгкий vanilla JS: только то, что нужно лендингу.
   Модули: header/scroll → mobile nav → reveal → counters → tabs
           → slider → accordion → active link → fab → misc
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  var prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var $ = function (selector, scope) {
    return (scope || document).querySelector(selector);
  };
  var $$ = function (selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  };

  /* -------------------------------- КАДРЫ ---------------------------------- */
  /* Один requestAnimationFrame на все скролл-подписки: в кадре не должно быть
     нескольких независимых циклов обновления (шапка + прогресс + меню). */
  var frame = (function () {
    var subscribers = [];
    var scheduled = false;

    function flush() {
      scheduled = false;
      subscribers.forEach(function (fn) { fn(); });
    }

    return {
      add: function (fn) { subscribers.push(fn); },
      request: function () {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(flush);
      }
    };
  })();

  /* --------------------------- КЭШ ГЕОМЕТРИИ СТРАНИЦЫ ---------------------- */
  /* scrollHeight и offsetTop, прочитанные внутри кадра прокрутки, заставляют
     браузер делать принудительный layout (замер давал ~2 пересчёта на кадр) —
     это и есть главная причина «дёрганья». Держим значения в кэше и обновляем
     только когда страница реально изменилась: resize, загрузка, шрифты,
     раскрытие пункта аккордеона. */
  var geo = (function () {
    var sections = [];
    var maxScroll = 0;
    var tops = [];
    var dirty = true;

    function measure() {
      maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      tops = sections.map(function (section) { return section.offsetTop; });
      dirty = false;
    }

    return {
      watch: function (section) { sections.push(section); dirty = true; },
      invalidate: function () { dirty = true; },
      read: function () {
        if (dirty) measure();
        return { maxScroll: maxScroll, tops: tops };
      }
    };
  })();

  function onViewportChange() {
    geo.invalidate();
    frame.request();
  }

  /* ------------------------------ HEADER / SCROLL --------------------------- */
  (function header() {
    var header = $("#header");
    var bar = $("#scrollBar");
    if (!header && !bar) return;

    var scrolled = false;
    var lastWidth = "";

    function update() {
      var y = window.pageYOffset || root.scrollTop;

      if (header) {
        var next = y > 12;
        if (next !== scrolled) {
          scrolled = next;
          header.classList.toggle("is-scrolled", next);
        }
      }

      if (bar) {
        var maxScroll = geo.read().maxScroll;   /* из кэша: без layout в кадре */
        var progress = maxScroll > 0 ? Math.min(y / maxScroll, 1) : 0;

        /* у самого низа уточняем высоту: кэш мог устареть (страница «села»
           после закрытия пункта аккордеона и т.п.) — иначе полоса никогда
           не дойдёт до 100% */
        if (progress > 0.995) {
          geo.invalidate();
          maxScroll = geo.read().maxScroll;
          progress = maxScroll > 0 ? Math.min(y / maxScroll, 1) : 0;
        }

        var width = (progress * 100).toFixed(2) + "%";
        if (width !== lastWidth) {              /* лишний раз не пишем в стиль */
          lastWidth = width;
          bar.style.width = width;
        }
      }
    }

    frame.add(update);
    window.addEventListener("scroll", frame.request, { passive: true });
    window.addEventListener("resize", onViewportChange, { passive: true });
    update();
  })();

  /* ------------------------------- MOBILE NAV ------------------------------- */
  (function mobileNav() {
    var burger = $("#burger");
    var nav = $("#nav");
    if (!burger || !nav) return;

    var links = $$(".nav__link", nav);

    function setOpen(isOpen) {
      nav.classList.toggle("is-open", isOpen);
      burger.setAttribute("aria-expanded", isOpen ? "true" : "false");
      burger.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
      document.body.classList.toggle("is-locked", isOpen);
    }

    function isOpen() {
      return nav.classList.contains("is-open");
    }

    burger.addEventListener("click", function () {
      setOpen(!isOpen());
    });

    links.forEach(function (link) {
      link.addEventListener("click", function () {
        if (isOpen()) setOpen(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen()) {
        setOpen(false);
        burger.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth >= 1024 && isOpen()) setOpen(false);
    });
  })();

  /* -------------------------------- REVEAL --------------------------------- */
  (function reveal() {
    var items = $$("[data-reveal]");
    if (!items.length) return;

    items.forEach(function (el) {
      var delay = el.getAttribute("data-reveal-delay");
      if (delay) el.style.setProperty("--reveal-delay", delay + "ms");
    });

    if (prefersReduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -7% 0px", threshold: 0.12 });

    items.forEach(function (el) { observer.observe(el); });
  })();

  /* -------------------------------- COUNTERS ------------------------------- */
  (function counters() {
    var nodes = $$("[data-counter]");
    if (!nodes.length) return;

    function format(value, decimals, grouped) {
      var text = value.toFixed(decimals);
      if (!grouped) return text.replace(".", ",");
      var parts = text.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");
      return parts.join(",");
    }

    function animate(el) {
      var target = parseFloat(el.getAttribute("data-counter"));
      if (isNaN(target)) return;

      var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
      var grouped = target >= 1000;
      var duration = 1500;
      var start = null;

      if (prefersReduced) {
        el.textContent = format(target, decimals, grouped);
        return;
      }

      function step(timestamp) {
        if (start === null) start = timestamp;
        var progress = Math.min((timestamp - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = format(target * eased, decimals, grouped);
        if (progress < 1) window.requestAnimationFrame(step);
        else el.textContent = format(target, decimals, grouped);
      }

      window.requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(animate);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.4 });

    nodes.forEach(function (el) { observer.observe(el); });
  })();

  /* ---------------------------------- TABS --------------------------------- */
  (function tabs() {
    var groups = $$(".tabs");
    if (!groups.length) return;

    groups.forEach(function (tabs) {
      var nav = $(".tabs__nav", tabs);
      var buttons = $$(".tabs__btn", tabs);
      if (!nav || buttons.length < 2) return;

      function activate(button, moveFocus) {
        buttons.forEach(function (btn) {
          var panel = document.getElementById(btn.getAttribute("aria-controls"));
          var active = btn === button;

          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
          btn.tabIndex = active ? 0 : -1;

          if (panel) {
            panel.classList.toggle("is-active", active);
            if (active) panel.removeAttribute("hidden");
            else panel.setAttribute("hidden", "");
          }
        });
        if (moveFocus) button.focus();
      }

      buttons.forEach(function (button) {
        button.addEventListener("click", function () { activate(button); });
      });

      nav.addEventListener("keydown", function (event) {
        var index = buttons.indexOf(document.activeElement);
        if (index === -1) return;

        var next = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % buttons.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = buttons.length - 1;

        if (next === null) return;
        event.preventDefault();
        activate(buttons[next], true);
      });
    });
  })();

  /* --------------------------------- SLIDER -------------------------------- */
  (function reviewsSlider() {
    var slider = $("#reviewsSlider");
    var viewport = $("#reviewsViewport");
    var track = $("#reviewsTrack");
    var dotsWrap = $("#reviewsDots");
    var prev = $("#reviewsPrev");
    var next = $("#reviewsNext");

    if (!slider || !viewport || !track) return;

    var slides = Array.prototype.slice.call(track.children);
    if (!slides.length) return;

    var index = 0;
    var timer = null;
    var AUTOPLAY = 7000;
    var dots = [];

    if (dotsWrap) {
      slides.forEach(function (slide, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "slider__dot";
        dot.setAttribute("aria-label", "Отзыв " + (i + 1) + " из " + slides.length);
        dot.addEventListener("click", function () { go(i); restart(); });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      });
    }

    function render() {
      track.style.transform = "translate3d(" + (-index * 100) + "%, 0, 0)";

      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === index);
        if (i === index) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });

      slides.forEach(function (slide, i) {
        var active = i === index;
        slide.setAttribute("aria-hidden", active ? "false" : "true");
        $$("a, button", slide).forEach(function (el) {
          el.tabIndex = active ? 0 : -1;
        });
      });
    }

    function go(target) {
      index = (target + slides.length) % slides.length;
      render();
    }

    function step(delta) { go(index + delta); }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      if (prefersReduced || slides.length < 2) return;
      stop();
      timer = window.setInterval(function () { step(1); }, AUTOPLAY);
    }

    function restart() { stop(); start(); }

    if (slides.length < 2) {
      if (prev) prev.style.display = "none";
      if (next) next.style.display = "none";
      if (dotsWrap) dotsWrap.style.display = "none";
      render();
      return;
    }

    if (prev) prev.addEventListener("click", function () { step(-1); restart(); });
    if (next) next.addEventListener("click", function () { step(1); restart(); });

    slider.addEventListener("mouseenter", stop);
    slider.addEventListener("mouseleave", start);
    slider.addEventListener("focusin", stop);
    slider.addEventListener("focusout", start);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else start();
    });

    /* свайпы */
    var startX = 0;
    var startY = 0;
    var tracking = false;

    viewport.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      tracking = true;
      startX = event.clientX;
      startY = event.clientY;
    }, { passive: true });

    viewport.addEventListener("pointerup", function (event) {
      if (!tracking) return;
      tracking = false;
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy)) return;
      step(dx < 0 ? 1 : -1);
      restart();
    }, { passive: true });

    viewport.addEventListener("pointercancel", function () { tracking = false; }, { passive: true });

    /* клавиатура */
    slider.addEventListener("keydown", function (event) {
      if (event.key === "ArrowRight") { event.preventDefault(); step(1); restart(); }
      if (event.key === "ArrowLeft") { event.preventDefault(); step(-1); restart(); }
    });

    render();
    start();
  })();

  /* -------------------------------- ACCORDION ------------------------------ */
  (function faqAccordion() {
    var box = $("#faqAccordion");
    if (!box) return;

    var items = $$(".accordion__item", box);
    if (!items.length) return;

    function panelOf(item) { return $(".accordion__panel", item); }
    function buttonOf(item) { return $(".accordion__btn", item); }

    function close(item) {
      var panel = panelOf(item);
      var button = buttonOf(item);

      item.classList.remove("is-open");
      if (button) button.setAttribute("aria-expanded", "false");
      if (panel) {
        panel.style.maxHeight = "0px";
        panel.setAttribute("aria-hidden", "true");
      }

      geo.invalidate();   /* высота страницы изменилась */
    }

    function open(item) {
      var panel = panelOf(item);
      var button = buttonOf(item);

      item.classList.add("is-open");
      if (button) button.setAttribute("aria-expanded", "true");
      if (panel) {
        panel.style.maxHeight = panel.scrollHeight + "px";
        panel.removeAttribute("aria-hidden");
      }

      geo.invalidate();   /* высота страницы изменилась */
    }

    items.forEach(function (item) {
      var button = buttonOf(item);
      if (!button) return;

      close(item);

      button.addEventListener("click", function () {
        var wasOpen = item.classList.contains("is-open");
        items.forEach(close);
        if (!wasOpen) open(item);
      });
    });

    /* пересчёт высоты открытого пункта при изменении ширины */
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        items.forEach(function (item) {
          if (!item.classList.contains("is-open")) return;
          var panel = panelOf(item);
          if (panel) panel.style.maxHeight = panel.scrollHeight + "px";
        });
        geo.invalidate();
      }, 150);
    }, { passive: true });
  })();

  /* ---------------------------- ACTIVE NAV LINK ---------------------------- */
  (function activeLink() {
    var links = $$(".nav__link");
    if (!links.length) return;

    var map = [];
    links.forEach(function (link) {
      var href = link.getAttribute("href");
      if (!href || href.charAt(0) !== "#") return;
      var section = document.getElementById(href.slice(1));
      if (section) {
        geo.watch(section);                 /* порядок = порядок tops в кэше */
        map.push({ link: link, section: section });
      }
    });
    if (!map.length) return;

    var currentIndex = -1;

    function update() {
      var tops = geo.read().tops;           /* без чтения offsetTop в кадре */
      var probe = (window.pageYOffset || root.scrollTop) + window.innerHeight * 0.32;
      var index = -1;

      for (var i = 0; i < map.length; i++) {
        if (tops[i] <= probe) index = i;
      }
      if (index === currentIndex) return;    /* ничего не изменилось */

      currentIndex = index;
      map.forEach(function (item, i) {
        var active = i === index;
        item.link.classList.toggle("is-active", active);
        if (active) item.link.setAttribute("aria-current", "true");
        else item.link.removeAttribute("aria-current");
      });
    }

    frame.add(update);
    window.addEventListener("scroll", frame.request, { passive: true });
    window.addEventListener("resize", onViewportChange, { passive: true });
    update();
  })();

  /* --------------------------- ПАУЗА ВНЕ ЭКРАНА ---------------------------- */
  /* Декоративные анимации (блобы героя, блик на коллаже, бегущая строка, пульс
     на карте) не нужны за пределами экрана: ставим их на паузу, чтобы они не
     отбирали кадры у прокрутки остальной страницы. */
  (function quietZones() {
    if (prefersReduced || !("IntersectionObserver" in window)) return;

    var zones = $$("#hero, .marquee, #contacts");
    if (!zones.length) return;

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        entry.target.classList.toggle("is-quiet", !entry.isIntersecting);
      });
    }, { rootMargin: "120px 0px" });

    zones.forEach(function (zone) { observer.observe(zone); });
  })();

  /* ---------------------------- ФОНОВОЕ ВИДЕО ------------------------------ */
  /* Кадр в самом начале страницы играет сам, но только пока его видно: вне
     экрана и в фоновой вкладке видео ставится на паузу, чтобы декодер не
     отбирал кадры у прокрутки. При «уменьшении анимации» видео не запускается —
     остаётся постер, он же подложка на время загрузки. */
  (function heroFilm() {
    var film = document.getElementById("topfilmVideo");
    if (!film) return;

    function play() {
      if (prefersReduced || document.hidden) return;
      var started = film.play();
      /* автозапуск может быть запрещён настройками браузера — тогда и постера
         достаточно, никаких ошибок показывать не нужно */
      if (started && started.catch) started.catch(function () {});
    }

    function pause() {
      if (!film.paused) film.pause();
    }

    if (prefersReduced) {
      pause();
      return;
    }

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) play();
          else pause();
        });
      }, { rootMargin: "150px 0px", threshold: 0.01 });
      observer.observe(film);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause();
      else play();
    });
  })();

  /* -------------------------- ПЛАВАЮЩИЙ ВИДЖЕТ СОЦСЕТЕЙ ---------------------- */
  /* Круглая кнопка раскрывает список соцсетей. В свёрнутом виде пункты невидимы
     (visibility в CSS) и потому не участвуют в таб-порядке; развёрнутый список
     закрывается по Esc, клику мимо и после перехода по ссылке. */
  (function fabWidget() {
    var fab = $("#fab");
    var toggle = $("#fabToggle");
    if (!fab || !toggle) return;

    function isOpen() {
      return fab.classList.contains("is-open");
    }

    function setOpen(open) {
      fab.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Салон в соцсетях — скрыть список" : "Салон в соцсетях — показать список");
    }

    toggle.addEventListener("click", function () {
      setOpen(!isOpen());
    });

    /* ссылка уводит в новую вкладку — список за этим больше не нужен */
    $$(".fab__link", fab).forEach(function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", function (event) {
      if (isOpen() && !fab.contains(event.target)) setOpen(false);
    });
  })();

  /* ---------------------------------- MISC --------------------------------- */
  (function misc() {
    var year = document.getElementById("year");
    if (year) year.textContent = String(new Date().getFullYear());
  })();

  /* ------------------------- ГЕОМЕТРИЯ ПОСЛЕ ЗАГРУЗКИ ---------------------- */
  /* Высоты секций меняются после подстановки веб-шрифтов, поэтому кэш геометрии
     обновляем по событиям, а не в каждом кадре прокрутки. */
  window.addEventListener("load", onViewportChange, { passive: true });
  if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
    document.fonts.ready.then(function () {
      geo.invalidate();
      frame.request();
    });
  }
})();
