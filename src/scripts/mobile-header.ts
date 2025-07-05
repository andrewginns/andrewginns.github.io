/**
 * Smart auto-hide mobile header with scroll detection
 * Industry-standard thresholds and behavior patterns
 */

interface HeaderConfig {
  scrollThreshold: number;
  hideThreshold: number;
  showThreshold: number;
  showTimeout: number;
}

interface ScrollState {
  lastScrollTop: number;
  scrollTimeout: number | null;
  isMenuOpen: boolean;
  cumulativeUpwardScroll: number;
  ticking: boolean;
}

class SmartMobileHeader {
  private header: HTMLElement | null = null;
  private hamburger: HTMLElement | null = null;
  private observer: MutationObserver | null = null;
  private scrollState: ScrollState;
  private config: HeaderConfig;

  constructor() {
    this.config = {
      scrollThreshold: 10, // Minimum scroll for shadow effect
      hideThreshold: 40, // Scroll distance before hiding
      showThreshold: 20, // Upward scroll distance before showing
      showTimeout: 3000, // Show header after 3s of no scrolling
    };

    this.scrollState = {
      lastScrollTop: 0,
      scrollTimeout: null,
      isMenuOpen: false,
      cumulativeUpwardScroll: 0,
      ticking: false,
    };
  }

  public init(): () => void {
    this.header = document.getElementById('mobile-header');
    this.hamburger = document.getElementById('mobile-hamburger');

    if (!this.header) {
      console.warn('Mobile header element not found');
      return () => {};
    }

    this.setupMenuObserver();
    this.attachScrollListener();
    this.handleScroll(); // Check initial position

    // Return cleanup function
    return this.cleanup.bind(this);
  }

  private setupMenuObserver(): void {
    if (this.hamburger) {
      this.observer = new MutationObserver(() => {
        this.scrollState.isMenuOpen = this.hamburger?.getAttribute('aria-expanded') === 'true';
      });

      this.observer.observe(this.hamburger, {
        attributes: true,
        attributeFilter: ['aria-expanded'],
      });
    }
  }

  private attachScrollListener(): void {
    window.addEventListener('scroll', this.requestTick.bind(this), { passive: true });
  }

  private requestTick(): void {
    if (!this.scrollState.ticking) {
      window.requestAnimationFrame(() => {
        this.handleScroll();
        this.scrollState.ticking = false;
      });
      this.scrollState.ticking = true;
    }
  }

  private handleScroll(): void {
    if (!this.header) return;

    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollDelta = scrollTop - this.scrollState.lastScrollTop;

    // Glass shadow effect
    this.updateShadowEffect(scrollTop);

    // Smart auto-hide logic
    this.updateHeaderVisibility(scrollTop, scrollDelta);

    // Auto-reveal timeout
    this.setupAutoReveal(scrollTop);

    this.scrollState.lastScrollTop = scrollTop;
  }

  private updateShadowEffect(scrollTop: number): void {
    if (!this.header) return;

    if (scrollTop > this.config.scrollThreshold) {
      this.header.classList.add('scrolled');
    } else {
      this.header.classList.remove('scrolled');
    }
  }

  private updateHeaderVisibility(scrollTop: number, scrollDelta: number): void {
    if (!this.header) return;

    if (scrollTop <= this.config.scrollThreshold) {
      // Always show at top of page
      this.showHeader();
      this.scrollState.cumulativeUpwardScroll = 0;
    } else if (!this.scrollState.isMenuOpen) {
      if (scrollDelta > 0) {
        // Scrolling down
        this.scrollState.cumulativeUpwardScroll = 0;
        if (scrollTop > this.config.hideThreshold) {
          this.hideHeader();
        }
      } else if (scrollDelta < 0) {
        // Scrolling up - accumulate upward movement
        this.scrollState.cumulativeUpwardScroll += Math.abs(scrollDelta);

        if (this.scrollState.cumulativeUpwardScroll >= this.config.showThreshold) {
          this.showHeader();
          this.scrollState.cumulativeUpwardScroll = 0;
        }
      }
    }
  }

  private setupAutoReveal(scrollTop: number): void {
    // Clear existing timeout
    if (this.scrollState.scrollTimeout) {
      clearTimeout(this.scrollState.scrollTimeout);
      this.scrollState.scrollTimeout = null;
    }

    // Show header after period of no scrolling
    if (scrollTop > this.config.hideThreshold && !this.scrollState.isMenuOpen) {
      this.scrollState.scrollTimeout = window.setTimeout(() => {
        this.showHeader();
      }, this.config.showTimeout);
    }
  }

  private hideHeader(): void {
    if (!this.header) return;
    this.header.classList.add('header-hidden');
  }

  private showHeader(): void {
    if (!this.header) return;
    this.header.classList.remove('header-hidden');
  }

  private cleanup(): void {
    // Remove scroll listener
    window.removeEventListener('scroll', this.requestTick.bind(this));

    // Clean up timeout
    if (this.scrollState.scrollTimeout) {
      clearTimeout(this.scrollState.scrollTimeout);
      this.scrollState.scrollTimeout = null;
    }

    // Clean up observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Reset state
    this.scrollState.ticking = false;
    this.scrollState.cumulativeUpwardScroll = 0;
  }
}

// Global instance management
let headerInstance: SmartMobileHeader | null = null;
let cleanup: (() => void) | null = null;

function initializeMobileHeader(): void {
  // Clean up previous instance
  if (cleanup) {
    cleanup();
  }

  // Create new instance
  headerInstance = new SmartMobileHeader();
  cleanup = headerInstance.init();
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeMobileHeader);
} else {
  initializeMobileHeader();
}

// Re-initialize after Astro ViewTransitions
document.addEventListener('astro:page-load', initializeMobileHeader);

// Export for testing/debugging
export { SmartMobileHeader, initializeMobileHeader };
