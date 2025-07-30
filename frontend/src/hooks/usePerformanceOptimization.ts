/**
 * Performance Optimization Hooks for Nixbit Frontend
 * Provides utilities for lazy loading, memoization, and performance monitoring
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';

// Lazy loading hook with intersection observer
export function useLazyLoading(threshold = 0.1) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          setHasLoaded(true);
          observer.unobserve(element);
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, hasLoaded]);

  return { elementRef, isVisible, hasLoaded };
}

// Debounced value hook for performance-sensitive inputs
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Optimized API data fetching hook
export function useOptimizedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    staleTime?: number;
    cacheTime?: number;
    refetchOnWindowFocus?: boolean;
    refetchInterval?: number;
    enabled?: boolean;
  } = {}
) {
  const defaultOptions = {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    ...options,
  };

  return useQuery(key, fetcher, defaultOptions);
}

// Virtual scrolling hook for large lists
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );

    return {
      startIndex,
      endIndex,
      items: items.slice(startIndex, endIndex),
      totalHeight: items.length * itemHeight,
      offsetY: startIndex * itemHeight,
    };
  }, [items, itemHeight, containerHeight, scrollTop]);

  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    handleScroll,
    scrollTop,
  };
}

// Performance monitoring hook
export function usePerformanceMonitoring(componentName: string) {
  const renderStart = useRef<number>(0);
  const renderCount = useRef<number>(0);

  useEffect(() => {
    renderStart.current = performance.now();
    renderCount.current += 1;
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStart.current;
    
    // Log slow renders (>16ms for 60fps)
    if (renderTime > 16) {
      console.warn(
        `Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms (render #${renderCount.current})`
      );
    }

    // Report to performance monitoring service
    if (window.gtag) {
      window.gtag('event', 'render_performance', {
        custom_parameter_1: componentName,
        custom_parameter_2: renderTime,
        custom_parameter_3: renderCount.current,
      });
    }
  });

  return {
    renderCount: renderCount.current,
    reportCustomMetric: (metricName: string, value: number) => {
      if (window.gtag) {
        window.gtag('event', 'custom_performance_metric', {
          custom_parameter_1: componentName,
          custom_parameter_2: metricName,
          custom_parameter_3: value,
        });
      }
    },
  };
}

// Batch state updates hook
export function useBatchedUpdates<T>(initialState: T, batchDelay = 100) {
  const [state, setState] = useState<T>(initialState);
  const pendingUpdates = useRef<Partial<T>[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const batchedSetState = useCallback((update: Partial<T>) => {
    pendingUpdates.current.push(update);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setState((prevState => {
        return pendingUpdates.current.reduce(
          (acc, update) => ({ ...acc, ...update }),
          prevState
        );
      }) as (prevState: T) => T);
      pendingUpdates.current = [];
      timeoutRef.current = null;
    }, batchDelay);
  }, [batchDelay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, batchedSetState] as const;
}

// Optimized table data hook with sorting, filtering, and pagination
export function useOptimizedTableData<T>(
  data: T[],
  options: {
    pageSize?: number;
    sortKey?: keyof T;
    sortDirection?: 'asc' | 'desc';
    filterFn?: (item: T) => boolean;
    searchTerm?: string;
    searchKeys?: (keyof T)[];
  } = {}
) {
  const {
    pageSize = 50,
    sortKey,
    sortDirection = 'asc',
    filterFn,
    searchTerm = '',
    searchKeys = [],
  } = options;

  const [currentPage, setCurrentPage] = useState(0);

  const processedData = useMemo(() => {
    let result = [...data];

    // Apply filtering
    if (filterFn) {
      result = result.filter(filterFn);
    }

    // Apply search
    if (searchTerm && searchKeys.length > 0) {
      const lowercaseSearchTerm = searchTerm.toLowerCase();
      result = result.filter(item =>
        searchKeys.some(key => {
          const value = item[key];
          return String(value).toLowerCase().includes(lowercaseSearchTerm);
        })
      );
    }

    // Apply sorting
    if (sortKey) {
      result.sort((a, b) => {
        const aValue = a[sortKey];
        const bValue = b[sortKey];
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, filterFn, searchTerm, searchKeys, sortKey, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    return processedData.slice(startIndex, endIndex);
  }, [processedData, currentPage, pageSize]);

  const totalPages = Math.ceil(processedData.length / pageSize);

  const goToPage = useCallback((page: number) => {
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const prevPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  // Reset to first page when data changes
  useEffect(() => {
    setCurrentPage(0);
  }, [processedData.length]);

  return {
    data: paginatedData,
    totalItems: processedData.length,
    totalPages,
    currentPage,
    pageSize,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage: currentPage < totalPages - 1,
    hasPrevPage: currentPage > 0,
  };
}

// Image lazy loading hook with placeholder
export function useImageLazyLoading(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const { elementRef, isVisible } = useLazyLoading();

  useEffect(() => {
    if (isVisible && src) {
      const img = new Image();
      
      img.onload = () => {
        setImageSrc(src);
        setIsLoaded(true);
      };
      
      img.onerror = () => {
        setIsError(true);
      };
      
      img.src = src;
    }
  }, [isVisible, src]);

  return {
    elementRef,
    imageSrc,
    isLoaded,
    isError,
    isVisible,
  };
}

// Memory-efficient data caching hook
export function useDataCache<T>(key: string, fetcher: () => Promise<T>, maxSize = 100) {
  const queryClient = useQueryClient();
  
  const getCachedData = useCallback((cacheKey: string): T | undefined => {
    return queryClient.getQueryData(cacheKey);
  }, [queryClient]);

  const setCachedData = useCallback((cacheKey: string, data: T) => {
    queryClient.setQueryData(cacheKey, data);
    
    // Implement LRU cache eviction
    const cacheKeys = queryClient.getQueryCache().getAll().map(query => query.queryKey);
    if (cacheKeys.length > maxSize) {
      const oldestKey = cacheKeys[0];
      queryClient.removeQueries(oldestKey);
    }
  }, [queryClient, maxSize]);

  const invalidateCache = useCallback((pattern?: string) => {
    if (pattern) {
      queryClient.invalidateQueries({ queryKey: [pattern] });
    } else {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient, key]);

  return {
    getCachedData,
    setCachedData,
    invalidateCache,
  };
}

// Component timing hook for performance analysis
export function useComponentTiming(componentName: string) {
  const mountTime = useRef<number>(0);
  const renderTimes = useRef<number[]>([]);

  useEffect(() => {
    mountTime.current = performance.now();
    
    return () => {
      const unmountTime = performance.now();
      const totalLifetime = unmountTime - mountTime.current;
      
      console.log(`Component ${componentName} lifecycle:`, {
        mountTime: mountTime.current,
        unmountTime,
        totalLifetime: totalLifetime.toFixed(2) + 'ms',
        averageRenderTime: renderTimes.current.length > 0 
          ? (renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length).toFixed(2) + 'ms'
          : 'N/A',
        renderCount: renderTimes.current.length,
      });
    };
  }, [componentName]);

  const recordRenderTime = useCallback(() => {
    const renderTime = performance.now();
    renderTimes.current.push(renderTime);
    
    // Keep only last 10 render times to prevent memory leaks
    if (renderTimes.current.length > 10) {
      renderTimes.current = renderTimes.current.slice(-10);
    }
  }, []);

  useEffect(() => {
    recordRenderTime();
  });

  return {
    mountTime: mountTime.current,
    renderCount: renderTimes.current.length,
    averageRenderTime: renderTimes.current.length > 0 
      ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length
      : 0,
  };
}