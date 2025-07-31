describe('Math Operations', () => {
  describe('Addition', () => {
    test('should add two positive numbers', () => {
      expect(2 + 3).toBe(5);
    });

    test('should add negative numbers', () => {
      expect(-2 + -3).toBe(-5);
    });

    test('should handle zero', () => {
      expect(0 + 5).toBe(5);
    });
  });

  describe('Multiplication', () => {
    test('should multiply positive numbers', () => {
      expect(3 * 4).toBe(12);
    });

    test('should handle zero multiplication', () => {
      expect(0 * 100).toBe(0);
    });
  });

  describe('Division', () => {
    test('should divide numbers correctly', () => {
      expect(10 / 2).toBe(5);
    });

    test('should handle division by zero', () => {
      expect(10 / 0).toBe(Infinity);
    });

    // Simulate a flaky test
    test('should simulate flaky network call', () => {
      const random = Math.random();
      if (random < 0.3) {
        throw new Error('Simulated network timeout');
      }
      expect(true).toBe(true);
    });
  });
});

describe('String Operations', () => {
  test('should concatenate strings', () => {
    expect('Hello' + ' ' + 'World').toBe('Hello World');
  });

  test('should get string length', () => {
    expect('test'.length).toBe(4);
  });

  test.skip('should skip this test', () => {
    expect(true).toBe(false);
  });
});