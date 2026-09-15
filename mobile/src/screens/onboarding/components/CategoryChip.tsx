import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';

interface CategoryChipProps {
  icon: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  chipWidth: number;
}

export const CategoryChip: React.FC<CategoryChipProps> = ({
  icon,
  label,
  selected,
  onPress,
  chipWidth,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        { width: chipWidth },
        selected ? styles.chipSelected : styles.chipUnselected,
      ]}
    >
      {selected && (
        <View style={styles.checkBadge}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
      )}
      <Text style={styles.icon}>{icon}</Text>
      <Text
        style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 9,
    borderRadius: 20,
    marginBottom: 8,
    marginRight: 6,
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'hidden',
  },
  chipSelected: {
    backgroundColor: '#EAF3EE',
    borderColor: '#1D5842',
  },
  chipUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2DDD5',
  },
  icon: {
    fontSize: 14,
    marginRight: 5,
    lineHeight: 18,
  },
  label: {
    fontSize: 11.5,
    fontWeight: '500',
    flex: 1,
  },
  labelSelected: {
    color: '#1D5842',
    fontWeight: '600',
  },
  labelUnselected: {
    color: '#3D3D3D',
  },
  checkBadge: {
    position: 'absolute',
    top: 2,
    right: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1D5842',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  checkMark: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 12,
  },
});
