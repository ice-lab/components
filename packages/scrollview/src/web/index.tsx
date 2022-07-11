import type { CSSProperties, ForwardRefExoticComponent, RefObject } from 'react';
import { forwardRef, useRef, useImperativeHandle } from 'react';
import cx from 'classnames';
import type { ScrollViewProps } from '../types';
import Timer from '../timer';
import throttle from '../throttle';
import defaultProps from '../defaultProps';
import '../index.css';

const FULL_WIDTH = 750;
const ANIMATION_DURATION = 400;
const STYLE_NODE_ID = 'ice-scrollview-style';
const baseCls = 'ice-scrollview';
let pixelRatio: number;

/**
 * Scroll to some position method
 * @param scrollerRef the scroll container ref
 * @param x offset x
 * @param y offset y
 * @param animated does it need animated
 * @param duration animate duration
 */
function scrollTo(scrollerRef: RefObject<HTMLDivElement>, x: number, y: number, animated: boolean, duration: number) {
  const scrollView = scrollerRef.current;
  const { scrollLeft } = scrollView;
  const { scrollTop } = scrollView;
  if (animated) {
    const timer = new Timer({
      duration,
      easing: 'easeOutSine',
      onRun: (e: any) => {
        if (scrollerRef && scrollerRef.current) {
          if (x >= 0) {
            scrollerRef.current.scrollLeft =
              scrollLeft + e.percent * (x - scrollLeft);
          }
          if (y >= 0) {
            scrollerRef.current.scrollTop =
              scrollTop + e.percent * (y - scrollTop);
          }
        }
      },
    });
    timer.run();
  } else {
    if (x >= 0) {
      scrollerRef.current.scrollLeft = x;
    }
    if (y >= 0) {
      scrollerRef.current.scrollTop = y;
    }
  }
}

function getPixelRatio() {
  if (pixelRatio) {
    return pixelRatio;
  }
  pixelRatio = document.documentElement.clientWidth / FULL_WIDTH;
  return pixelRatio;
}

function translateToPx(origin: string | number): number {
  const dpr = getPixelRatio();
  if (typeof origin === 'number') {
    return origin * dpr;
  }
  const matched = /^(\d+)(r?px)?$/.exec(origin);
  if (matched) {
    if (!matched[2]) {
      return parseInt(matched[1], 10) * dpr;
    }
    if (matched[2] === 'rpx') {
      return parseInt(matched[1], 10) * dpr;
    }
    if (matched[2] === 'px') {
      return parseInt(matched[1], 10);
    }
  }
  return 0;
}

const ScrollView: ForwardRefExoticComponent<ScrollViewProps> = forwardRef(
  (props, ref) => {
    const {
      className,
      style,
      horizontal,
      contentContainerStyle,
      disableScroll,
      scrollEventThrottle,
      showsHorizontalScrollIndicator,
      showsVerticalScrollIndicator,
      onEndReached,
      onEndReachedThreshold,
      onScroll,
      children,
      ...rest
    } = props;
    const lastScrollDistance = useRef(0);
    const lastScrollContentSize = useRef(0);
    const scrollerNodeSize = useRef(0);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const contentContainerRef = useRef<HTMLDivElement>(null);
    const handleScroll = (e: Event | any) => {
      if (props.onScroll) {
        e.nativeEvent = {
          get contentOffset() {
            return {
              x: e.target.scrollLeft,
              y: e.target.scrollTop,
            };
          },
          get contentSize() {
            return {
              width: e.target.scrollWidth,
              height: e.target.scrollHeight,
            };
          },
        };
        onScroll(e);
      }

      if (onEndReached) {
        const scrollerNode = scrollerRef.current;
        scrollerNodeSize.current = horizontal
          ? scrollerNode.offsetWidth
          : scrollerNode.offsetHeight;
        // NOTE：in iOS7/8 offsetHeight/Width is is inaccurate （ use scrollHeight/Width ）
        const scrollContentSize = horizontal
          ? scrollerNode.scrollWidth
          : scrollerNode.scrollHeight;
        const scrollDistance = horizontal
          ? scrollerNode.scrollLeft
          : scrollerNode.scrollTop;

        const endReachedThreshold = translateToPx(onEndReachedThreshold);

        const isEndReached =
          scrollContentSize - scrollDistance - scrollerNodeSize.current <
          endReachedThreshold;

        const isScrollToEnd = scrollDistance > lastScrollDistance.current;
        const isLoadedMoreContent = scrollContentSize !== lastScrollContentSize.current;

        if (isEndReached && isScrollToEnd && isLoadedMoreContent) {
          lastScrollContentSize.current = scrollContentSize;
          props.onEndReached(e);
        }

        lastScrollDistance.current = scrollDistance;
      }
    };
    useImperativeHandle(ref, () => ({
      _nativeNode: scrollerRef.current,
      resetScroll() {
        lastScrollContentSize.current = 0;
        lastScrollDistance.current = 0;
      },
      scrollTo(options?: {
        x?: number | string;
        y?: number | string;
        animated?: boolean;
        duration?: number;
      }) {
        const { x = 0, y = 0, animated = true, duration = ANIMATION_DURATION } = options || {};

        scrollTo(scrollerRef, translateToPx(x), translateToPx(y), animated, duration);
      },
      scrollIntoView(options?: {
        id?: string;
        animated?: boolean;
        duration?: number;
      }) {
        const { id, animated = true, duration = ANIMATION_DURATION } = options || {};
        if (!id) {
          throw new Error('Params missing id.');
        }
        const targetElement = document.getElementById(id);
        if (targetElement && contentContainerRef.current) {
          const targetRect = targetElement.getBoundingClientRect();
          const contentContainerRect = contentContainerRef.current.getBoundingClientRect();
          const targetDistance = {
            x: targetRect.x - contentContainerRect.x,
            y: targetRect.y - contentContainerRect.y,
          };
          // @NOTE: targetElement's offsetParent is not scrollerRef.current, so do not use
          // offsetLeft/offsetTop to calculate distance.
          scrollTo(scrollerRef, targetDistance.x, targetDistance.y, animated, duration);
        }
      },
    }));

    if (style) {
      // @ts-ignore
      const childLayoutProps = ['alignItems', 'justifyContent'].filter((prop) => style[prop] !== undefined);

      if (childLayoutProps.length !== 0) {
        // eslint-disable-next-line no-console
        console.warn(`ScrollView child layout (${JSON.stringify(childLayoutProps)}) must be applied through the contentContainerStyle prop.`);
      }
    }

    const contentContainer = (
      // @ts-ignore
      <div
        ref={contentContainerRef}
        className={cx({
          [`${baseCls}-content-container-horizontal`]: horizontal,
          [`${baseCls}-webcontainer`]: !horizontal,
        })}
        style={contentContainerStyle}
      >
        {children}
      </div>
    );

    const scrollerStyle: CSSProperties = {
      ...style,
    };

    if (scrollerStyle.height === null || scrollerStyle.height === undefined) {
      scrollerStyle.flex = 1;
    }
    const cls = cx(
      baseCls,
      `${baseCls}-${horizontal ? 'horizontal' : 'vertical'}`,
      className,
    );
    const showsScrollIndicator = horizontal
      ? showsHorizontalScrollIndicator
      : showsVerticalScrollIndicator;
    {
      if (
        !showsScrollIndicator &&
        typeof document !== 'undefined' &&
        typeof document.getElementById === 'function' &&
        !document.getElementById(STYLE_NODE_ID)
      ) {
        const styleNode = document.createElement('style');
        styleNode.id = STYLE_NODE_ID;
        document.head.appendChild(styleNode);
        styleNode.innerHTML = `.${baseCls}::-webkit-scrollbar{display: none;}`;
      }

      scrollerStyle.WebkitOverflowScrolling = 'touch';
      if (horizontal) {
        scrollerStyle.overflowX = 'scroll';
        scrollerStyle.overflowY = 'hidden';
      } else {
        scrollerStyle.overflowX = 'hidden';
        scrollerStyle.overflowY = 'scroll';
      }

      if (disableScroll) {
        scrollerStyle.overflow = 'hidden';
      }

      const webProps = {
        ...rest,
      };
      return (
        // @ts-ignore
        <div
          {...webProps}
          ref={scrollerRef}
          className={cls}
          style={scrollerStyle}
          onScroll={
            scrollEventThrottle
              ? throttle(handleScroll, scrollEventThrottle)
              : handleScroll
          }
        >
          {contentContainer}
        </div>
      );
    }
  },
);

export default defaultProps(ScrollView);
