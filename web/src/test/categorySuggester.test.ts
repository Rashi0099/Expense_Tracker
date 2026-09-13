import { describe, it, expect } from 'vitest';
import { getSuggestedCategory } from '@/utils/categorySuggester';
import { Category } from '@/types/category';

describe('Deterministic Smart Category Suggester', () => {
  const sampleCategories: Category[] = [
    { id: '1', name: 'Food & Dining', type: 'EXPENSE', color: '#F4BBA6', icon: '🍔', isSystem: true, isArchived: false },
    { id: '2', name: 'Transport', type: 'EXPENSE', color: '#E89EB7', icon: '🚗', isSystem: true, isArchived: false },
    { id: '3', name: 'Shopping', type: 'EXPENSE', color: '#E6DE98', icon: '🛒', isSystem: true, isArchived: false },
    { id: '4', name: 'Entertainment', type: 'EXPENSE', color: '#B5C0EA', icon: '🎬', isSystem: true, isArchived: false },
  ];

  it('suggests Food & Dining for Swiggy or Starbucks', () => {
    const swiggyMatch = getSuggestedCategory('Swiggy Order #1234', sampleCategories);
    expect(swiggyMatch?.name).toBe('Food & Dining');

    const starbucksMatch = getSuggestedCategory('Starbucks Coffee', sampleCategories);
    expect(starbucksMatch?.name).toBe('Food & Dining');
  });

  it('suggests Transport for Uber or Metro', () => {
    const uberMatch = getSuggestedCategory('Uber Ride', sampleCategories);
    expect(uberMatch?.name).toBe('Transport');
  });

  it('suggests Shopping for Amazon or Flipkart', () => {
    const amazonMatch = getSuggestedCategory('Amazon Marketplace purchase', sampleCategories);
    expect(amazonMatch?.name).toBe('Shopping');
  });

  it('suggests Entertainment for Netflix or Spotify', () => {
    const netflixMatch = getSuggestedCategory('Netflix monthly subscription', sampleCategories);
    expect(netflixMatch?.name).toBe('Entertainment');
  });

  it('returns null for unknown or empty payee', () => {
    expect(getSuggestedCategory('', sampleCategories)).toBeNull();
    expect(getSuggestedCategory('Unknown Vendor 987', sampleCategories)).toBeNull();
  });
});
