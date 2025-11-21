import React from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface Props {
  avg: number;
  size?: number;
}

const StarRating: React.FC<Props> = ({ avg, size = 18 }) => {
  const stars = [0, 1, 2, 3, 4];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {stars.map((i) => {
        const threshold = i + 1;
        let name: React.ComponentProps<typeof MaterialIcons>['name'] = 'star-border';
        if (avg >= threshold) name = 'star';
        else if (avg > i && avg < threshold) name = 'star-half';
        return (
          <MaterialIcons
            key={i}
            name={name}
            size={size}
            color={name === 'star-border' ? '#ddd' : '#C9A043'}
            style={{ marginRight: 4 }}
          />
        );
      })}
    </View>
  );
};

export default StarRating;
