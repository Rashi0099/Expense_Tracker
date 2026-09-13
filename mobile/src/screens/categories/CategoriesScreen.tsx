import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Screen } from '../../components/common/Screen';
import { Card } from '../../components/common/Card';
import { TextInput } from '../../components/forms/TextInput';
import { Button } from '../../components/common/Button';
import { CategoryModel, CategoryType } from '../../domain/models';
import {
  listCategoriesUseCase,
  createCategoryUseCase,
} from '../../domain/usecases/categoryUseCases';
import { useTheme } from '../../theme/useTheme';
import { DataEvents } from '../../database/sqlite/DataEvents';

const POPULAR_EMOJIS = ['🍔', '🛒', '🚗', '🛍️', '⚡', '🎬', '💼', '📈', '💻', '🏥', '✈️', '🎓', '☕', '🏠', '🎁', '📱'];
const PRESET_COLORS = ['#F97316', '#10B981', '#3B82F6', '#EC4899', '#F59E0B', '#8B5CF6', '#059669', '#0284C7'];

export const CategoriesScreen: React.FC = () => {
  const { theme } = useTheme();

  const [categories, setCategories] = useState<CategoryModel[]>([]);
  const [selectedType, setSelectedType] = useState<CategoryType | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  // Add Category Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<CategoryType>('EXPENSE');
  const [newCatIcon, setNewCatIcon] = useState('🏷️');
  const [newCatColor, setNewCatColor] = useState('#3B82F6');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const typeFilter = selectedType === 'ALL' ? undefined : selectedType;
      const list = await listCategoriesUseCase(typeFilter);
      setCategories(list);
    } catch {
      // Handled
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    const unsub = DataEvents.subscribe('CATEGORIES_CHANGED', () => {
      loadCategories();
    });
    return unsub;
  }, [loadCategories]);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      setError('Please enter a category name.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await createCategoryUseCase({
        name: newCatName.trim(),
        type: newCatType,
        icon: newCatIcon,
        color: newCatColor,
      });

      setNewCatName('');
      setIsModalOpen(false);
      loadCategories();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create category');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Category Manager</Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            {categories.length} categories available offline
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setNewCatName('');
            setNewCatIcon('🏷️');
            setNewCatColor('#3B82F6');
            setError(null);
            setIsModalOpen(true);
          }}
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.addButtonText}>+ New Category</Text>
        </TouchableOpacity>
      </View>

      {/* Type Toggle Pills */}
      <View style={styles.tabRow}>
        {(['ALL', 'EXPENSE', 'INCOME'] as const).map((type) => {
          const isSelected = selectedType === type;
          return (
            <TouchableOpacity
              key={type}
              onPress={() => setSelectedType(type)}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isSelected ? theme.colors.primary : theme.colors.surfaceSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  { color: isSelected ? '#FFFFFF' : theme.colors.textSecondary },
                ]}
              >
                {type === 'ALL' ? 'All Categories' : type === 'EXPENSE' ? 'Expenses' : 'Income'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category List */}
      <FlatList
        data={categories}
        keyExtractor={(item) => item.id}
        refreshing={isLoading}
        onRefresh={loadCategories}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.cardLeft}>
              <View style={[styles.iconBox, { backgroundColor: `${item.color}25` }]}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <View>
                <Text style={[styles.catName, { color: theme.colors.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.catMeta, { color: theme.colors.textMuted }]}>
                  {item.type} {item.isSystem ? '• Default System' : '• Custom Category'}
                </Text>
              </View>
            </View>
            <View style={[styles.colorDot, { backgroundColor: item.color }]} />
          </Card>
        )}
      />

      {/* Add Category Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.colors.textPrimary }]}>
                Create Custom Category
              </Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.closeBtn}>
                <Text style={[styles.closeBtnText, { color: theme.colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              <TextInput
                label="Category Name"
                value={newCatName}
                onChangeText={(val) => {
                  setNewCatName(val);
                  if (error) setError(null);
                }}
                placeholder="e.g. Pet Care, Gaming, Side Gig"
                error={error || undefined}
              />

              {/* Type Switcher */}
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Type</Text>
              <View style={styles.typeSelector}>
                {(['EXPENSE', 'INCOME'] as const).map((t) => {
                  const isSelected = newCatType === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setNewCatType(t)}
                      style={[
                        styles.typeBtn,
                        {
                          backgroundColor: isSelected
                            ? t === 'EXPENSE'
                              ? theme.colors.expense
                              : theme.colors.income
                            : theme.colors.surfaceSubtle,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeBtnText,
                          { color: isSelected ? '#FFFFFF' : theme.colors.textPrimary },
                        ]}
                      >
                        {t === 'EXPENSE' ? 'Expense Category' : 'Income Category'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Emoji Grid */}
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Select Symbol</Text>
              <View style={styles.emojiGrid}>
                {POPULAR_EMOJIS.map((emoji) => {
                  const isSelected = newCatIcon === emoji;
                  return (
                    <TouchableOpacity
                      key={emoji}
                      onPress={() => setNewCatIcon(emoji)}
                      style={[
                        styles.emojiCell,
                        {
                          backgroundColor: isSelected ? theme.colors.primaryLight : theme.colors.surfaceSubtle,
                          borderColor: isSelected ? theme.colors.primary : 'transparent',
                        },
                      ]}
                    >
                      <Text style={styles.emojiText}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Color Palette */}
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Theme Color</Text>
              <View style={styles.colorPalette}>
                {PRESET_COLORS.map((color) => {
                  const isSelected = newCatColor === color;
                  return (
                    <TouchableOpacity
                      key={color}
                      onPress={() => setNewCatColor(color)}
                      style={[
                        styles.colorCircle,
                        {
                          backgroundColor: color,
                          borderColor: isSelected ? theme.colors.textPrimary : 'transparent',
                        },
                      ]}
                    />
                  );
                })}
              </View>

              {/* Save Button */}
              <Button
                label="Create Category"
                onPress={handleCreateCategory}
                isLoading={isSaving}
                size="md"
                style={styles.createBtn}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 8,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
  },
  catName: {
    fontSize: 14,
    fontWeight: '700',
  },
  catMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 8,
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollBody: {
    paddingBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emojiCell: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  emojiText: {
    fontSize: 20,
  },
  colorPalette: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
  },
  createBtn: {
    marginTop: 16,
    width: '100%',
  },
});
