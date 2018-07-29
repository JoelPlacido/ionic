import { Component, Element, Event, EventEmitter, Listen, Method, Prop, QueueApi } from '@stencil/core';

import { Config, Mode, ScrollBaseDetail, ScrollDetail } from '../../interface';
import { createThemedClasses } from '../../utils/theme';

@Component({
  tag: 'ion-scroll',
  styleUrl: 'scroll.scss',
  shadow: true
})
export class Scroll {

  private watchDog: any;
  private isScrolling = false;
  private lastScroll = 0;
  private detail: ScrollDetail;
  private queued = false;

  @Element() el!: HTMLElement;

  @Prop({ context: 'config' }) config!: Config;
  @Prop({ context: 'queue' }) queue!: QueueApi;
  @Prop({ context: 'window' }) win!: Window;

  /** The mode for component. */
  @Prop() mode!: Mode;

  /**
   * If true and the content does not cause an overflow scroll, the scroll interaction will cause a bounce.
   * If the content exceeds the bounds of ionScroll, nothing will change.
   * Note, the does not disable the system bounce on iOS. That is an OS level setting.
   */
  @Prop({ mutable: true }) forceOverscroll?: boolean;

  /** If true, the component will emit scroll events. */
  @Prop() scrollEvents = false;

  /**
   * Emitted when the scroll has started.
   */
  @Event() ionScrollStart!: EventEmitter<ScrollBaseDetail>;

  /**
   * Emitted while scrolling. This event is disabled by default.
   * Look at the property: `scrollEvents`
   */
  @Event() ionScroll!: EventEmitter<ScrollDetail>;

  /**
   * Emitted when the scroll has ended.
   */
  @Event() ionScrollEnd!: EventEmitter<ScrollBaseDetail>;

  constructor() {
    // Detail is used in a hot loop in the scroll event, by allocating it here
    // V8 will be able to inline any read/write to it since it's a monomorphic class.
    // https://mrale.ph/blog/2015/01/11/whats-up-with-monomorphism.html
    this.detail = {
      positions: [],
      scrollTop: 0,
      scrollLeft: 0,
      type: 'scroll',
      event: undefined!,
      startX: 0,
      startY: 0,
      startTimeStamp: 0,
      currentX: 0,
      currentY: 0,
      velocityX: 0,
      velocityY: 0,
      deltaX: 0,
      deltaY: 0,
      timeStamp: 0,
      data: undefined,
      isScrolling: true,
    };
  }

  componentWillLoad() {
    if (this.forceOverscroll === undefined) {
      this.forceOverscroll = this.mode === 'ios' && ('ontouchstart' in this.win);
    }
  }

  componentDidUnload() {
    if (this.watchDog) {
      clearInterval(this.watchDog);
    }
  }

  @Listen('scroll', { passive: true })
  onScroll(ev: UIEvent) {
    const timeStamp = Date.now();
    const didStart = !this.isScrolling;
    this.lastScroll = timeStamp;
    if (didStart) {
      this.onScrollStart();
    }
    if (!this.queued && this.scrollEvents) {
      this.queued = true;
      this.queue.read(ts => {
        this.queued = false;
        this.detail.event = ev;
        updateScrollDetail(this.detail, this.el, ts!, didStart);
        this.ionScroll.emit(this.detail);
      });
    }
  }

  /** Scroll to the top of the component */
  @Method()
  scrollToTop(duration: number): Promise<void> {
    return this.scrollToPoint(0, 0, duration);
  }

  /** Scroll to the bottom of the component */
  @Method()
  scrollToBottom(duration: number): Promise<void> {
    const y = (this.el)
      ? this.el.scrollHeight - this.el.clientHeight
      : 0;

    return this.scrollToPoint(0, y, duration);
  }

  /** Scroll by a specified X/Y distance in the component */
  @Method()
  scrollByPoint(x: number, y: number, duration: number): Promise<any> {
    return this.scrollToPoint(x + this.el.scrollLeft, y + this.el.scrollTop, duration);
  }

  /** Scroll to a specified X/Y location in the component */
  @Method()
  scrollToPoint(x: number, y: number, duration: number): Promise<void> {
    // scroll animation loop w/ easing
    // credit https://gist.github.com/dezinezync/5487119

    let resolve!: () => void;
    const promise = new Promise<void>(r => {
      resolve = r;
    });

    const self = this;
    const el = self.el;
    if (!el) {
      // invalid element
      resolve();
      return promise;
    }

    if (duration < 32) {
      el.scrollTop = y;
      el.scrollLeft = x;
      resolve();
      return promise;
    }

    const fromY = el.scrollTop;
    const fromX = el.scrollLeft;

    const maxAttempts = (duration / 16) + 100;

    let startTime: number;
    let attempts = 0;
    let stopScroll = false;

    // scroll loop
    function step(timeStamp: number) {
      attempts++;

      if (!self.el || stopScroll || attempts > maxAttempts) {
        self.isScrolling = false;
        el.style.transform = el.style.webkitTransform = '';
        resolve();
        return;
      }

      let time = Math.min(1, ((timeStamp - startTime) / duration));

      // where .5 would be 50% of time on a linear scale easedT gives a
      // fraction based on the easing method
      const easedT = (--time) * time * time + 1;

      if (fromY !== y) {
        el.scrollTop = (easedT * (y - fromY)) + fromY;
      }

      if (fromX !== x) {
        el.scrollLeft = Math.floor((easedT * (x - fromX)) + fromX);
      }

      if (easedT < 1) {
        // do not use DomController here
        // must use nativeRaf in order to fire in the next frame
        // TODO: remove as any
        self.queue.read(step as any);

      } else {
        stopScroll = true;
        self.isScrolling = false;
        el.style.transform = el.style.webkitTransform = '';
        resolve();
      }
    }

    // start scroll loop
    self.isScrolling = true;

    // chill out for a frame first
    this.queue.write(() => {
      this.queue.write(timeStamp => {
        // TODO: review stencilt type of timeStamp
        startTime = timeStamp!;
        step(timeStamp!);
      });
    });

    return promise;
  }

  private onScrollStart() {
    this.isScrolling = true;
    this.ionScrollStart.emit({
      isScrolling: true
    });

    if (this.watchDog) {
      clearInterval(this.watchDog);
    }
    // watchdog
    this.watchDog = setInterval(() => {
      if (this.lastScroll < Date.now() - 120) {
        this.onScrollEnd();
      }
    }, 100);
  }

  private onScrollEnd() {

    clearInterval(this.watchDog);
    this.watchDog = null;
    this.isScrolling = false;
    this.ionScrollEnd.emit({
      isScrolling: false
    });
  }

  hostData() {
    return {
      class: {
        ...createThemedClasses(this.mode, 'scroll'),
        overscroll: this.forceOverscroll
      }
    };
  }

  render() {
    return <slot></slot>;
  }
}

// ******** DOM READ ****************
function updateScrollDetail(
  detail: ScrollDetail,
  el: HTMLElement,
  timeStamp: number,
  didStart: boolean
) {
  const scrollTop = el.scrollTop;
  const scrollLeft = el.scrollLeft;
  const positions = detail.positions;
  if (didStart) {
    // remember the start positions
    detail.startTimeStamp = timeStamp;
    detail.startY = scrollTop;
    detail.startX = scrollLeft;
    positions.length = 0;
  }

  detail.timeStamp = timeStamp;
  detail.currentY = detail.scrollTop = scrollTop;
  detail.currentX = detail.scrollLeft = scrollLeft;
  detail.deltaY = scrollTop - detail.startY;
  detail.deltaX = scrollLeft - detail.startX;

  // actively scrolling
  positions.push(scrollTop, scrollLeft, timeStamp);

  // move pointer to position measured 100ms ago
  const timeRange = timeStamp - 100;
  let startPos = positions.length - 1;

  while (startPos > 0 && positions[startPos] > timeRange) {
    startPos -= 3;
  }

  if (startPos > 3) {
    // compute relative movement between these two points
    const frequency = 1 / (positions[startPos] - timeStamp);
    const movedX = positions[startPos - 1] - scrollLeft;
    const movedY = positions[startPos - 2] - scrollTop;

    // based on XXms compute the movement to apply for each render step
    // velocity = space/time = s*(1/t) = s*frequency
    detail.velocityX = movedX * frequency;
    detail.velocityY = movedY * frequency;
  } else {
    detail.velocityX = 0;
    detail.velocityY = 0;
  }
}
