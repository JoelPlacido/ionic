import { Component, Element, Listen, Prop } from '@stencil/core';

import { Color, CssClassMap, Mode, RouterDirection } from '../../interface';
import { createColorClasses, hostContext, openURL } from '../../utils/theme';

@Component({
  tag: 'ion-item',
  styleUrls: {
    ios: 'item.ios.scss',
    md: 'item.md.scss'
  },
  shadow: true
})
export class Item {
  private itemStyles = new Map<string, CssClassMap>();

  @Element() el!: HTMLStencilElement;

  @Prop({ context: 'window' }) win!: Window;

  /**
   * The color to use from your application's color palette.
   * Default options are: `"primary"`, `"secondary"`, `"tertiary"`, `"success"`, `"warning"`, `"danger"`, `"light"`, `"medium"`, and `"dark"`.
   * For more information on colors, see [theming](/docs/theming/basics).
   */
  @Prop() color?: Color;

  /**
   * The mode determines which platform styles to use.
   * Possible values are: `"ios"` or `"md"`.
   */
  @Prop() mode!: Mode;

  /**
   * If true, a button tag will be rendered and the item will be tappable. Defaults to `false`.
   */
  @Prop() button = false;

  /**
   * If true, a detail arrow will appear on the item. Defaults to `false` unless the `mode`
   * is `ios` and an `href`, `onclick` or `button` property is present.
   */
  @Prop() detail?: boolean;

  /**
   * The icon to use when `detail` is set to `true`. Defaults to `"ios-arrow-forward"`.
   */
  @Prop() detailIcon = 'ios-arrow-forward';

  /**
   * If true, the user cannot interact with the item. Defaults to `false`.
   */
  @Prop() disabled = false;

  /**
   * Contains a URL or a URL fragment that the hyperlink points to.
   * If this property is set, an anchor tag will be rendered.
   */
  @Prop() href?: string;

  /**
   * How the bottom border should be displayed on the item.
   */
  @Prop() lines?: 'full' | 'inset' | 'none';

  /**
   * When using a router, it specifies the transition direction when navigating to
   * another page using `href`.
   */
  @Prop() routerDirection?: RouterDirection;

  // TODO document this
  @Prop() state?: 'valid' | 'invalid' | 'focus';

  /**
   * The type of the button. Only used when an `onclick` or `button` property is present.
   * Possible values are: `"submit"`, `"reset"` and `"button"`.
   * Default value is: `"button"`
   */
  @Prop() type: 'submit' | 'reset' | 'button' = 'button';

  @Listen('ionStyle')
  itemStyle(ev: UIEvent) {
    ev.stopPropagation();

    const tagName: string = (ev.target as HTMLElement).tagName;
    const updatedStyles = ev.detail as any;
    const updatedKeys = Object.keys(ev.detail);
    const newStyles = {} as any;
    const childStyles = this.itemStyles.get(tagName) || {};
    let hasStyleChange = false;
    for (const key of updatedKeys) {
      const itemKey = `item-${key}`;
      const newValue = updatedStyles[key];
      if (newValue !== childStyles[itemKey]) {
        hasStyleChange = true;
      }
      newStyles[itemKey] = newValue;
    }

    if (hasStyleChange) {
      this.itemStyles.set(tagName, newStyles);
      this.el.forceUpdate();
    }
  }

  componentDidLoad() {
    // Change the button size to small for each ion-button in the item
    // unless the size is explicitly set
    Array.from(this.el.querySelectorAll('ion-button')).forEach(button => {
      if (!button.size) {
        button.size = 'small';
      }
    });
  }

  private isClickable(): boolean {
    return !!(this.href || this.el.onclick || this.button);
  }

  hostData() {
    const childStyles = {};
    for (const value of this.itemStyles.values()) {
      Object.assign(childStyles, value);
    }

    return {
      'tappable': this.isClickable(),
      class: {
        ...childStyles,
        ...createColorClasses(this.color),
        [`item-lines-${this.lines}`]: !!this.lines,
        'item-disabled': this.disabled,
        'in-list': hostContext('ion-list', this.el),
        'item': true
      }
    };
  }

  render() {
    const { href, detail, mode, win, state, detailIcon, el, routerDirection, type } = this;

    const clickable = this.isClickable();
    const TagType = clickable ? (href ? 'a' : 'button') : 'div';
    const attrs = TagType === 'button' ? { type } : { href };
    const showDetail = detail != null ? detail : mode === 'ios' && clickable;

    return (
      <TagType
        {...attrs}
        class="item-native"
        onClick={ev => openURL(win, href, ev, routerDirection)}
      >
        <slot name="start"></slot>
        <div class="item-inner">
          <div class="input-wrapper">
            <slot></slot>
          </div>
          <slot name="end"></slot>
          { showDetail && <ion-icon icon={detailIcon} lazy={false} class="item-detail-icon"></ion-icon> }
        </div>
        { state && <div class="item-state"></div> }
        { clickable && mode === 'md' && <ion-ripple-effect tapClick={true} parent={el} /> }
      </TagType>
    );
  }
}
