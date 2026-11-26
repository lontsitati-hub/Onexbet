import React from 'react';
import { Dimensions, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

interface TicketSeparatorProps {
  cardColor: string;
  pageColor: string;
  dividerColor: string;
  height?: number;
  notchSide?: 'both' | 'left' | 'right' | 'none';
}

/**
 * Séparateur perforé du coupon.
 *
 * Les encoches sont de vraies soustractions dans le chemin du ticket. La
 * géométrie utilise la largeur réellement rendue par le séparateur afin que
 * les découpes restent circulaires et parfaitement symétriques sur mobile.
 */
export const TicketSeparator: React.FC<TicketSeparatorProps> = ({
  cardColor,
  pageColor,
  dividerColor,
  height = 18,
  notchSide = 'both',
}) => {
  const [renderedWidth, setRenderedWidth] = React.useState(() => Dimensions.get('window').width);
  const notchRadius = 6;
  const centerY = height / 2;
  const width = Math.max(renderedWidth, notchRadius * 2 + 2);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0 && nextWidth !== renderedWidth) {
      setRenderedWidth(nextWidth);
    }
  };

  // Le rectangle reste volontairement simple. Les deux cercles de page sont
  // dessinés par-dessus pour produire les encoches de façon fiable sur iOS,
  // Android et Web, sans dépendre de l'interprétation de fillRule.
  const perforatedTicket = `M 0 0 H ${width} V ${height} H 0 Z`;

  return (
    <View
      onLayout={handleLayout}
      style={[styles.container, { height, backgroundColor: pageColor }]}
    >
      <Svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <Path
          d={perforatedTicket}
          fill={cardColor}
        />
        <Line
          x1={notchSide === 'left' || notchSide === 'both' ? notchRadius + 5 : 0}
          x2={notchSide === 'right' || notchSide === 'both' ? width - notchRadius - 5 : width}
          y1={centerY}
          y2={centerY}
          stroke={dividerColor}
          strokeWidth={0.8}
          strokeDasharray="2, 3"
        />
        {(notchSide === 'left' || notchSide === 'both') && (
          <Circle cx={0} cy={centerY} r={notchRadius} fill={pageColor} />
        )}
        {(notchSide === 'right' || notchSide === 'both') && (
          <Circle cx={width} cy={centerY} r={notchRadius} fill={pageColor} />
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
});

export default TicketSeparator;
