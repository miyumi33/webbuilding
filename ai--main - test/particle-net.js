/*!
 * particle-net.js v1.0.0
 * 「点线星空 / particle network」——canvas-nest.js 的视觉复刻，零依赖。
 * MIT License
 *
 * 视觉签名（与原版 canvas-nest@2.0.4 默认参数一致）：
 *   · 99 个随机点，每帧位移 -1 ~ 1 px，撞到画布边缘反弹
 *   · 点 1×1 px，颜色 rgba(0,0,0)（点本身不透明）
 *   · 两点距离 < 77.5px（平方距离 6000）时连线，
 *     透明度 = (1 - d/max) + 0.2，线宽 = (1 - d/max) / 2
 *   · 鼠标作为一个「半径 141.4px（平方距离 20000）」的临时节点参与连线，
 *     并且在 100px ~ 141.4px 之间会把附近的点轻轻推开
 *   · 整块画布 opacity 0.5，z-index -1，position absolute 铺满挂载元素
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else if (typeof define === "function" && define.amd) define([], factory);
  else root.ParticleNet = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULTS = {
    count: 99, // 点的数量（原版 count，缺省 99）
    linkDistance: 77.4597, // 点与点的连线阈值 px（原版平方距离 6000 → √6000）
    mouseRadius: 141.4214, // 鼠标节点半径 px（原版平方距离 20000 → √20000）
    dotSize: 1, // 点边长 px（原版 1）
    color: "0, 0, 0", // 点的颜色 "r, g, b"
    lineColor: null, // 连线颜色，null 表示跟随 color
    fade: false, // 连线按距离淡出（库的设计意图，但 rath.work 上因配置未生效）
    opacity: 1, // 整块画布透明度（rath.work 实际为 1）
    zIndex: 0, // 画布层级；建议配合一个全屏容器使用
    speed: 1, // 运动速度倍率（1 = 原始速度）
    density: true, // 粒子数随画布面积等比缩放：单位面积的密度恒定
    baseArea: 0, // 密度基准面积，0 表示用构造时的画布面积
    minCount: 6, // 密度缩放的下限
    maxCount: 500, // 密度缩放的上限（性能保护）
    onCountChange: null, // 数量变化回调 (count) => void
    interactive: true, // 鼠标交互
    dpr: "auto", // 像素比：'auto' 跟随屏幕，或传 1 / 2 固定
    motion: "respect", // 'respect' 尊重系统「减少动态效果」；'ignore' 始终播放
    frameRateNormalize: true, // 按 60fps 归一化步长（高刷屏不会更快）
  };

  function toColor(c) {
    return typeof c === "string" ? c : "0, 0, 0";
  }

  function clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  }

  function ParticleNet(target, options) {
    if (!(this instanceof ParticleNet)) return new ParticleNet(target, options);

    var el = typeof target === "string" ? document.querySelector(target) : target;
    this.el = el || document.body;
    this.options = Object.assign({}, DEFAULTS, options || {});

    this.points = [];
    this.mouse = { x: null, y: null };
    this.width = 0;
    this.height = 0;
    this.fps = 0;

    this._raf = 0;
    this._last = 0;
    this._paused = false;
    this._destroyed = false;
    this._reduced = false;
    this._frames = 0;
    this._fpsAt = 0;

    this._tick = this._onTick.bind(this);
    this._move = this._onMove.bind(this);
    this._leave = this._onLeave.bind(this);
    this._resize = this._onResize.bind(this);
    this._visibility = this._onVisibility.bind(this);

    this._setup();
  }

  ParticleNet.prototype._setup = function () {
    var opts = this.options;

    if (window.getComputedStyle(this.el).position === "static") {
      this.el.style.position = "relative";
    }

    var canvas = document.createElement("canvas");
    canvas.style.cssText = [
      "display:block",
      "position:absolute",
      "top:0",
      "left:0",
      "width:100%",
      "height:100%",
      "overflow:hidden",
      "pointer-events:none",
      "z-index:" + opts.zIndex,
      "opacity:" + opts.opacity,
    ].join(";");
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("data-pn", "particle-net");

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.el.appendChild(canvas);

    this._measure();
    this.baseArea =
      Number(opts.baseArea) > 0 ? Number(opts.baseArea) : this.width * this.height;
    this._seed(this._targetCount());

    window.addEventListener("resize", this._resize);
    window.addEventListener("pointermove", this._move, { passive: true });
    window.addEventListener("pointerleave", this._leave);
    window.addEventListener("blur", this._leave);
    document.addEventListener("visibilitychange", this._visibility);

    if (typeof ResizeObserver === "function") {
      this._ro = new ResizeObserver(this._resize);
      this._ro.observe(this.el);
    }

    this._reduced =
      opts.motion === "respect" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (this._reduced) this._draw(1);
    else this.start();
  };

  ParticleNet.prototype._measure = function () {
    var opts = this.options;
    var w = Math.max(1, this.el.clientWidth);
    var h = Math.max(1, this.el.clientHeight);
    var dpr =
      opts.dpr === "auto"
        ? Math.min(window.devicePixelRatio || 1, 2)
        : Number(opts.dpr) || 1;

    if (this.canvas.width !== Math.round(w * dpr)) this.canvas.width = Math.round(w * dpr);
    if (this.canvas.height !== Math.round(h * dpr)) this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.width = w;
    this.height = h;
  };

  ParticleNet.prototype._newPoint = function () {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: Math.random() * 2 - 1,
      vy: Math.random() * 2 - 1,
    };
  };

  /** 生成 count 个点，速度在 -1 ~ 1 之间（原版 xa/ya） */
  ParticleNet.prototype._seed = function (count) {
    var pts = [];
    for (var i = 0; i < count; i++) pts.push(this._newPoint());
    this.points = pts;
    this._notifyCount();
  };

  /**
   * 按「单位面积密度恒定」算出当前该有多少个点：
   * density 为 true 时 count 是基准面积下的数量，随画布面积等比缩放。
   */
  ParticleNet.prototype._targetCount = function () {
    var cfg = this.options;
    var n = Number(cfg.count) || 0;

    if (!cfg.density || !this.baseArea) return Math.max(0, Math.round(n));

    n = Math.round((n * (this.width * this.height)) / this.baseArea);
    return clamp(n, Math.max(0, cfg.minCount), Math.max(1, cfg.maxCount));
  };

  /** 把点数组调整到目标数量（多了随机删、少了随机加） */
  ParticleNet.prototype._syncCount = function () {
    var pts = this.points;
    var target = this._targetCount();
    var changed = false;

    while (pts.length < target) {
      pts.push(this._newPoint());
      changed = true;
    }
    while (pts.length > target) {
      pts.splice(Math.floor(Math.random() * pts.length), 1);
      changed = true;
    }

    if (changed) this._notifyCount();
    return changed;
  };

  ParticleNet.prototype._notifyCount = function () {
    var fn = this.options.onCountChange;
    if (typeof fn === "function") fn(this.points.length, this);
  };

  ParticleNet.prototype._onResize = function () {
    this._measure();
    this._syncCount();
  };

  ParticleNet.prototype._onMove = function (e) {
    if (!this.options.interactive) return;
    var rect = this.el.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  };

  ParticleNet.prototype._onLeave = function () {
    this.mouse.x = null;
    this.mouse.y = null;
  };

  ParticleNet.prototype._onVisibility = function () {
    if (document.hidden) {
      this._stop();
    } else if (!this._paused && !this._reduced) {
      this.start();
    }
  };

  ParticleNet.prototype._onTick = function (now) {
    if (this._destroyed) return;

    var dt = this._last ? now - this._last : 16.667;
    this._last = now;

    var step = this.options.frameRateNormalize ? clamp(dt, 0, 50) / 16.667 : 1;
    this._draw(step);

    this._frames++;
    if (now - this._fpsAt >= 500) {
      this.fps = Math.round((this._frames * 1000) / (now - this._fpsAt));
      this._frames = 0;
      this._fpsAt = now;
    }

    this._raf = window.requestAnimationFrame(this._tick);
  };

  ParticleNet.prototype._draw = function (step) {
    var ctx = this.ctx;
    var cfg = this.options;
    var w = this.width;
    var h = this.height;
    var pts = this.points;
    var speed = cfg.speed * step;

    var linkSq = Math.max(1, cfg.linkDistance);
    linkSq = linkSq * linkSq;

    var mouseSq = Math.max(0, cfg.mouseRadius);
    mouseSq = mouseSq * mouseSq;

    var lineColor = toColor(cfg.lineColor || cfg.color);
    var dotColor = "rgba(" + toColor(cfg.color) + ")";
    var half = cfg.dotSize / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = dotColor;

    var hasMouse = cfg.interactive && this.mouse.x !== null && typeof this.mouse.x === "number";

    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];

      p.x += p.vx * speed;
      p.y += p.vy * speed;

      if (p.x < 0) {
        p.x = 0;
        p.vx = Math.abs(p.vx);
      } else if (p.x > w) {
        p.x = w;
        p.vx = -Math.abs(p.vx);
      }
      if (p.y < 0) {
        p.y = 0;
        p.vy = Math.abs(p.vy);
      } else if (p.y > h) {
        p.y = h;
        p.vy = -Math.abs(p.vy);
      }

      ctx.fillRect(p.x - half, p.y - half, cfg.dotSize, cfg.dotSize);

      for (var j = i + 1; j < pts.length; j++) {
        this._link(p, pts[j], linkSq, lineColor);
      }

      if (hasMouse && mouseSq > 0) {
        this._mouseLink(p, mouseSq, lineColor);
      }
    }
  };

  ParticleNet.prototype._link = function (a, b, maxSq, color) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    var d2 = dx * dx + dy * dy;
    if (d2 >= maxSq) return;
    this._stroke(a, b, (maxSq - d2) / maxSq, color);
  };

  ParticleNet.prototype._mouseLink = function (p, maxSq, color) {
    var dx = p.x - this.mouse.x;
    var dy = p.y - this.mouse.y;
    var d2 = dx * dx + dy * dy;
    if (d2 >= maxSq) return;

    // 原版：距离在 max/2 ~ max 之间时，把点往远离鼠标的方向推 3%
    if (d2 >= maxSq / 2) {
      p.x -= 0.03 * dx;
      p.y -= 0.03 * dy;
    }

    this._stroke(p, this.mouse, (maxSq - d2) / maxSq, color);
  };

  /** 一条线：线宽 = c/2；透明度按 fade 决定（原站实际不淡出，全靠亚像素线宽制造层次） */
  ParticleNet.prototype._stroke = function (a, b, c, color) {
    var ctx = this.ctx;
    ctx.beginPath();
    ctx.lineWidth = c / 2;
    ctx.strokeStyle =
      "rgba(" + color + "," + (this.options.fade ? Math.min(1, c + 0.2) : 1) + ")";
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  /* ── 公共 API ───────────────────────────────────────────── */

  ParticleNet.prototype.start = function () {
    if (this._raf || this._destroyed) return;
    this._paused = false;
    this._last = 0;
    this._raf = window.requestAnimationFrame(this._tick);
    return this;
  };

  ParticleNet.prototype.pause = function () {
    this._paused = true;
    this._stop();
    return this;
  };

  ParticleNet.prototype.toggle = function () {
    return this._raf ? this.pause() : this.start();
  };

  ParticleNet.prototype._stop = function () {
    if (this._raf) window.cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._last = 0;
  };

  /** 运行时改参数：net.set({ count: 160 }) */
  ParticleNet.prototype.set = function (patch) {
    var cfg = this.options;
    Object.assign(cfg, patch || {});

    if (patch && patch.zIndex !== undefined) this.canvas.style.zIndex = cfg.zIndex;
    if (patch && patch.opacity !== undefined) this.canvas.style.opacity = cfg.opacity;

    // 改数量：以当前画布尺寸为新基准，立即生效；只开关密度则沿用原基准
    if (patch && patch.count !== undefined) {
      this.baseArea = this.width * this.height;
      this._syncCount();
    } else if (patch && patch.density !== undefined) {
      this._syncCount();
    }

    if (patch && patch.baseArea !== undefined && Number(cfg.baseArea) > 0) {
      this.baseArea = Number(cfg.baseArea);
      this._syncCount();
    }

    if (patch && patch.dpr !== undefined) this._measure();
    if (patch && patch.interactive === false) this._onLeave();

    if (this._paused || this._reduced) this._draw(1);
    return this;
  };

  Object.defineProperty(ParticleNet.prototype, "running", {
    get: function () {
      return !!this._raf;
    },
  });

  /** 当前实际点数（密度模式下会随面积变化） */
  Object.defineProperty(ParticleNet.prototype, "count", {
    get: function () {
      return this.points.length;
    },
  });

  ParticleNet.prototype.destroy = function () {
    this._destroyed = true;
    this._stop();
    window.removeEventListener("resize", this._resize);
    window.removeEventListener("pointermove", this._move);
    window.removeEventListener("pointerleave", this._leave);
    window.removeEventListener("blur", this._leave);
    document.removeEventListener("visibilitychange", this._visibility);
    if (this._ro) this._ro.disconnect();
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  };

  ParticleNet.defaults = DEFAULTS;
  ParticleNet.version = "1.0.0";

  return ParticleNet;
});
