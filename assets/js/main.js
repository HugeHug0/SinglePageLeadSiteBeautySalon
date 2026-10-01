/* ==========================================================================
   Terata — beauty & spa
   Лёгкий vanilla JS: только то, что нужно лендингу.
   Модули: header/scroll → mobile nav → reveal → counters → tabs
           → slider → accordion → active link → fab → booking form → misc
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

  /* ---------------------------- ФОРМА ЗАПИСИ ------------------------------ */
  /* Собирает данные формы секции #booking, проверяет обязательные поля (имя,
     телефон, согласие) и отправляет JSON на серверless-функцию /api/get-data.
     Поля телефон/дата/время маскируются при вводе: только цифры, автоформат,
     корректный backspace; несуществующую дату и время ввести нельзя. Остальные
     поля (услуга, мастер, комментарий) уходят как есть. Скрытое поле-ловушка
     отсекает спам-ботов.
     После отправки экран ВСЕГДА показывает успех — после асинхронной паузы в
     500 мс и вне зависимости от того, что ответил (или не ответил) сервер. */
  (function bookingForm() {
    var form = $("#bookingForm");
    if (!form) return;

    var status = $("#bookingStatus");
    var submit = $("button[type='submit']", form);
    var ENDPOINT = "api/get-data";
    var SUCCESS_DELAY = 500;   /* искусственная пауза перед показом успеха, мс */

    var fields = {
      name: $("#bookingName"),
      phone: $("#bookingPhone"),
      consent: $("#bookingConsent")
    };
    if (!fields.name || !fields.phone || !fields.consent) return;

    /* карточка секции — на ней включается экран успеха */
    var card = (function () {
      var el = form.parentNode;
      while (el && el.nodeType === 1) {
        if (el.classList && el.classList.contains("booking__card")) return el;
        el = el.parentNode;
      }
      return null;
    })();

    /* ------------------------- МАСКИ ПОЛЕЙ ПРИ ВВОДЕ ------------------------ */
    /* Телефон, дата и время вводятся только цифрами и форматируются прямо во
       время набора. Backspace удаляет последнюю цифру, лишние символы молча
       отбрасываются. Это надёжнее нативных date/time и ведёт себя одинаково во
       всех браузерах. */
    function isDigitChar(ch) { return ch >= "0" && ch <= "9"; }

    function countDigits(value) {
      var n = 0;
      for (var i = 0; i < value.length; i++) if (isDigitChar(value.charAt(i))) n++;
      return n;
    }

    /* индекс каретки, при котором справа в строке остаётся ровно trailing цифр */
    function caretByTrailing(formatted, trailing) {
      if (trailing <= 0) return formatted.length;
      var seen = 0;
      for (var i = formatted.length - 1; i >= 0; i--) {
        if (isDigitChar(formatted.charAt(i))) {
          seen++;
          if (seen === trailing) return i;
        }
      }
      return 0;
    }

    /* навешивает на поле форматирование «на лету»: parse — что оставить из
       введённого, format — как это показать. allow (необязательный) отсекает
       невозможные значения: неподходящие цифры справа отбрасываются, так что
       неверное число записать просто нельзя. Каретку держим по числу цифр
       справа, поэтому backspace и правка в середине не «прыгают». */
    function maskInput(input, parse, format, allow) {
      function apply() {
        var value = input.value;
        var caret = input.selectionStart == null ? value.length : input.selectionStart;
        var trailing = countDigits(value) - countDigits(value.slice(0, caret));
        var digits = parse(value);

        if (allow) {
          /* отбрасываем правые цифры, пока значение не станет допустимым */
          while (digits && !allow(digits)) {
            digits = digits.slice(0, -1);
            trailing = Math.min(trailing, countDigits(digits));
          }
        }

        var next = format(digits);
        if (next !== value) input.value = next;

        var pos = caretByTrailing(next, Math.min(trailing, countDigits(next)));
        try { input.setSelectionRange(pos, pos); } catch (e) { /* не критично */ }
      }
      input.addEventListener("input", apply);
      if (input.value) apply();
    }

    /* +7 (999) 123-45-67: «8» в начале превращаем в «7», без ведущей «7» — добавляем */
    function phoneParse(value) {
      var d = value.replace(/\D/g, "");
      if (!d) return "";
      if (d.charAt(0) === "8") d = "7" + d.slice(1);
      else if (d.charAt(0) !== "7") d = "7" + d;
      return d.slice(0, 11);
    }
    function phoneFormat(d) {
      if (!d) return "";
      var rest = d.slice(1);
      var out = "+7";
      if (rest.length) out += " (" + rest.slice(0, 3);
      if (rest.length > 3) out += ") " + rest.slice(3, 6);
      if (rest.length > 6) out += "-" + rest.slice(6, 8);
      if (rest.length > 8) out += "-" + rest.slice(8, 10);
      return out;
    }

    /* ДД.ММ.ГГГГ */
    function dateParse(value) { return value.replace(/\D/g, "").slice(0, 8); }
    function dateFormat(d) {
      if (!d) return "";
      var out = d.slice(0, 2);
      if (d.length > 2) out += "." + d.slice(2, 4);
      if (d.length > 4) out += "." + d.slice(4, 8);
      return out;
    }

    /* ЧЧ:ММ */
    function timeParse(value) { return value.replace(/\D/g, "").slice(0, 4); }
    function timeFormat(d) {
      if (!d) return "";
      if (d.length <= 2) return d;
      return d.slice(0, 2) + ":" + d.slice(2, 4);
    }

    maskInput(fields.phone, phoneParse, phoneFormat);
    var dateField = $("#bookingDate");
    var timeField = $("#bookingTime");
    if (dateField) maskInput(dateField, dateParse, dateFormat, dateDigitsOk);
    if (timeField) maskInput(timeField, timeParse, timeFormat, timeDigitsOk);

    /* обёртка поля (для подсветки ошибки): .field для input/select/textarea
       и .checkbox для галочки согласия */
    function wrapOf(input) {
      var el = input.parentNode;
      while (el && el !== form) {
        if (el.classList && (el.classList.contains("field") || el.classList.contains("checkbox"))) {
          return el;
        }
        el = el.parentNode;
      }
      return null;
    }

    function setInvalid(input, invalid) {
      var wrap = wrapOf(input);
      if (wrap) wrap.classList.toggle("is-invalid", invalid);
      input.setAttribute("aria-invalid", invalid ? "true" : "false");
    }

    /* телефон считается заполненным, когда введены все 11 цифр маски */
    function phoneOk(value) {
      return phoneParse(value).length === 11;
    }

    /* сколько дней в месяце; пока год не введён целиком, февраль считаем
       високосным, чтобы разрешить 29.02 до появления полного года */
    function daysInMonth(month, year) {
      if (month === 2) {
        var leap = year === null || (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0));
        return leap ? 29 : 28;
      }
      return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    }

    /* можно ли записать такие цифры даты — несуществующий день/месяц не вводится */
    function dateDigitsOk(digits) {
      var day = digits.slice(0, 2);
      var month = digits.slice(2, 4);
      var year = digits.length >= 8 ? +digits.slice(4, 8) : null;

      if (day.length === 1 && +day > 3) return false;          /* день не больше 31 */
      if (day.length === 2 && (+day < 1 || +day > 31)) return false;
      if (month.length === 1 && +month > 1) return false;      /* месяц не больше 12 */
      if (month.length === 2 && (+month < 1 || +month > 12)) return false;
      if (day.length === 2 && month.length === 2 && +day > daysInMonth(+month, year)) return false;
      return true;
    }

    /* можно ли записать такие цифры времени — только 00:00–23:59 */
    function timeDigitsOk(digits) {
      var hour = digits.slice(0, 2);
      var minute = digits.slice(2, 4);
      if (hour.length === 1 && +hour > 2) return false;
      if (hour.length === 2 && +hour > 23) return false;
      if (minute.length === 1 && +minute > 5) return false;
      if (minute.length === 2 && +minute > 59) return false;
      return true;
    }

    function setStatus(message, state) {
      if (!status) return;
      status.textContent = message || "";
      status.classList.remove("is-success", "is-error");
      if (state) status.classList.add("is-" + state);
    }

    function collect() {
      var data = {};
      $$("input, select, textarea", form).forEach(function (input) {
        var name = input.getAttribute("name");
        if (!name) return;
        data[name] = input.type === "checkbox" ? input.checked : input.value.trim();
      });
      return data;
    }

    /* при правке поле перестаёт считаться ошибочным */
    Object.keys(fields).forEach(function (key) {
      var input = fields[key];
      input.addEventListener(input.type === "checkbox" ? "change" : "input", function () {
        setInvalid(input, false);
      });
    });

    /* возвращает текст ошибки или пустую строку, если всё в порядке */
    function validate() {
      var first = null;
      var checks = [
        [fields.name, fields.name.value.trim().length >= 2],
        [fields.phone, phoneOk(fields.phone.value)],
        [fields.consent, fields.consent.checked]
      ];

      checks.forEach(function (pair) {
        setInvalid(pair[0], !pair[1]);
        if (!pair[1] && !first) first = pair[0];
      });

      if (!first) return "";
      first.focus();
      return "Заполните имя, телефон и подтвердите согласие на обработку данных.";
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (form.getAttribute("data-sending") === "true") return;

      var problem = validate();
      if (problem) {
        setStatus(problem, "error");
        return;
      }

      var payload = collect();

      /* бот заполнил скрытое поле — тихо «съедаем» отправку */
      if (payload.company) {
        form.reset();
        setStatus("Спасибо! Заявка отправлена — мы свяжемся с вами.", "success");
        return;
      }
      delete payload.company;

      form.setAttribute("data-sending", "true");
      if (submit) submit.disabled = true;
      setStatus("Отправляем заявку…");

      /* Запрос уходит «в фоне» и не влияет на экран: ответ сервера (в том числе
         ошибку) не показываем — гость в любом случае увидит успех. Ошибку сети
         гасим здесь же, чтобы «непойманный» запрос не всплыл в консоли. */
      try {
        window.fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(function () { /* намеренно игнорируем */ });
      } catch (e) { /* офлайн или старый браузер — успех всё равно покажем */ }

      /* Асинхронная пауза 500 мс: setTimeout не блокирует поток и не «замораживает»
         интерфейс. После неё показываем успех независимо от ответа сервера. */
      window.setTimeout(function () {
        form.reset();
        Object.keys(fields).forEach(function (key) { setInvalid(fields[key], false); });
        setStatus("Спасибо! Заявка отправлена — администратор перезвонит и подтвердит время.", "success");
        form.removeAttribute("data-sending");
        if (submit) submit.disabled = false;
        /* явный экран успеха: прячем форму и показываем сообщение об отправке */
        if (card) card.classList.add("is-done");
      }, SUCCESS_DELAY);
    });
  })();

  /* ---------------------- ДЕМО-УВЕДОМЛЕНИЕ О ЗВОНКЕ ------------------------ */
  /* Проект демонстрационный: любая кнопка звонка (ссылка tel:) не набирает
     номер, а показывает короткое всплывающее уведомление внизу экрана. */
  (function demoNotice() {
    var toast = document.getElementById("demoToast");
    if (!toast) return;
    var timer = null;

    function show() {
      toast.classList.add("is-visible");
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        toast.classList.remove("is-visible");
        timer = null;
      }, 2600);
    }

    document.addEventListener("click", function (event) {
      var node = event.target;
      var link = null;
      while (node && node !== document) {
        if (node.tagName === "A") {
          var href = node.getAttribute("href") || "";
          if (href.indexOf("tel:") === 0) { link = node; break; }
        }
        node = node.parentNode;
      }
      if (!link) return;
      event.preventDefault();
      show();
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
