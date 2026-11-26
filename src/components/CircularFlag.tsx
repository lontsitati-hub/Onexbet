import { resolveOnlineTeamLogo } from '@/utils/logoResolver';
import { getLocalCountryFlag, LOCAL_COUNTRY_FLAGS } from '@/constants/localCountryFlags';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CircularFlagProps } from '../types/bet';
import { MORTAL_KOMBAT_FIGHTERS } from '@/components/admin/MortalKombatPickerModal';

// Comprehensive list of country roots/keywords in English & French to detect country teams
const COUNTRIES_LIST = [
  'belgi', 'camer', 'togo', 'tunis', 'japon', 'japan', 'maroc', 'moroc', 'alger', 'seneg', 'egyp',
  'mali', 'ivoir', 'ivory', 'ghana', 'niger', 'congo', 'benin', 'burkina', 'guin', 'gabon', 'south africa',
  'france', 'spain', 'espag', 'germany', 'allem', 'ital', 'england', 'anglet', 'portug', 'brazil', 'bresil',
  'argent', 'urug', 'croat', 'nether', 'pays-bas', 'swiss', 'suiss', 'swed', 'suede', 'norw', 'norve',
  'denm', 'danem', 'polon', 'poland', 'russia', 'russi', 'turk', 'turqu', 'ukrain', 'usa', 'state', 'etats-unis',
  'mexic', 'canad', 'colomb', 'chili', 'peru', 'ecuad', 'equat', 'venez', 'boliv', 'parag', 'austra', 'korea',
  'coree', 'china', 'chine', 'saudi', 'arab', 'iran', 'iraq', 'irak', 'qatar', 'egypt', 'senegal',
  'wales', 'pays de galles', 'scotland', 'ecosse', 'ireland', 'irlande', 'austri', 'autric', 'belgique',
  'turquie', 'switzerland', 'sweden', 'norway', 'denmark', 'finland', 'finlan', 'greece', 'grece',
  'romania', 'rouman', 'bulgari', 'hungar', 'hongr', 'czech', 'tcheq', 'slovak', 'slovaq', 'croatia',
  'serbia', 'serbi', 'sloven', 'slovaq', 'alban', 'macedo', 'kosovo', 'monten', 'georgi', 'armeni',
  'azerb', 'cyprus', 'chypr', 'israel', 'palest', 'leban', 'liban', 'syria', 'syrie', 'jordan', 'jordou',
  'kuwait', 'bahra', 'oman', 'yemen', 'india', 'inde', 'pakist', 'bangla', 'nepal', 'sri lanka',
  'myanm', 'thail', 'vietn', 'malays', 'singap', 'indon', 'philipp', 'taiwan', 'mongol', 'uzbek',
  'kazakh', 'kyrgy', 'tajik', 'turkme', 'afghan', 'libya', 'libye', 'sudan', 'ethiop', 'somali',
  'kenya', 'ugand', 'ougand', 'rwanda', 'burund', 'eritrea', 'erithr', 'djibout', 'angola', 'zambia',
  'zimbab', 'malawi', 'mozamb', 'namib', 'botsw', 'lesoth', 'swazi', 'madagas', 'maurit', 'seych',
  'comor', 'cape verd', 'cap-vert', 'sao tome', 'equatorial guinea', 'guinee equat', 'cameroon',
  'chad', 'tchad', 'central african', 'centrafr', 'congo', 'gabonese', 'gabon', 'angola', 'zair',
  'tanzan', 'somalia', 'liberia', 'sierra leon', 'guinea-bissau', 'guinee-bissau', 'gambia', 'gambie',
  'senegambia', 'mauritania', 'mauritan', 'western sahara', 'sahara occ', 'morocco', 'algeria',
  'tunisia', 'libya', 'egypt', 'sudan', 'south sudan', 'soudan', 'eritrea', 'djibouti', 'somalia',
  'ethiopia', 'uganda', 'kenya', 'rwanda', 'burundi', 'tanzania', 'seychelles', 'comoros', 'mauritius',
  'madagascar', 'mozambique', 'malawi', 'zambia', 'zimbabwe', 'angola', 'namibia', 'botswana',
  'lesotho', 'swaziland', 'south africa', 'eswatini', 'togo', 'benin', 'nigeria', 'niger', 'chad',
  'cameroon', 'equatorial guinea', 'gabon', 'congo', 'democratic republic of congo', 'rdc', 'car',
  'hondur', 'costa ric', 'panama', 'jamaic', 'haiti', 'cuba', 'dominic', 'puerto ric', 'baham',
  'barbad', 'trinid', 'venezu', 'colomb', 'ecuad', 'peru', 'boliv', 'parag', 'chile', 'argent',
  'urugu', 'brazi', 'guyana', 'surinam', 'falkl', 'new zeal', 'nouvelle-zelande', 'fiji', 'fidji',
  'samoa', 'tonga', 'vanuat', 'new caled', 'nouvelle-caledonie', 'solomon', 'papua', 'papouas'
];

export const CircularFlag: React.FC<CircularFlagProps> = ({ countryCode, size = 28, teamName }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [countryCode]);

  // Map codes or URLs to Image Source objects with User-Agent header
  const getFlagUrl = (code: string): any => {
    if (!code) return { uri: '' };
    if (code.startsWith('mortal:')) {
      const fighter = MORTAL_KOMBAT_FIGHTERS.find((item) => `mortal:${item.key}` === code.toLowerCase());
      return fighter?.image || { uri: '' };
    }
    if (code.startsWith('http')) {
      return {
        uri: code,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      };
    }
    const cleanCode = code.trim().toLowerCase();

    // Automatically support any two-letter country code
    if (cleanCode.length === 2) {
      return { uri: `https://flagcdn.com/w320/${cleanCode}.png` };
    }

    switch (cleanCode) {
      case 'us':
        return { uri: 'https://flagcdn.com/w320/us.png' };
      case 'au':
        return { uri: 'https://flagcdn.com/w320/au.png' };
      case 'scotland':
        return { uri: 'https://flagcdn.com/w320/gb-sct.png' };
      case 'wales':
        return { uri: 'https://flagcdn.com/w320/gb-wls.png' };
      case 'england':
        return { uri: 'https://flagcdn.com/w320/gb-eng.png' };
      default:
        return { uri: `https://flagcdn.com/w320/${cleanCode}.png` };
    }
  };

  // Render a clean CSS/View fallback for offline/rendering safety
  const renderFallback = (targetSize: number) => {
    const cleanCode = (countryCode || '').trim().toLowerCase();
    switch (cleanCode) {
      case 'be':
        return (
          <View style={[styles.fallbackContainer, { width: targetSize, height: targetSize, flexDirection: 'row' }]}>
            <View style={{ flex: 1, backgroundColor: '#000000' }} />
            <View style={{ flex: 1, backgroundColor: '#FFE300' }} />
            <View style={{ flex: 1, backgroundColor: '#ED2939' }} />
          </View>
        );

      case 'tn':
        return (
          <View style={[styles.fallbackContainer, { width: targetSize, height: targetSize, backgroundColor: '#E10A17', justifyContent: 'center', alignItems: 'center' }]}>
            <View style={{ width: targetSize * 0.55, height: targetSize * 0.55, borderRadius: (targetSize * 0.55) / 2, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#E10A17', fontSize: targetSize * 0.28, fontWeight: 'bold', top: -1 }}>☪</Text>
            </View>
          </View>
        );

      case 'jp':
        return (
          <View style={[styles.fallbackContainer, { width: targetSize, height: targetSize, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }]}>
            <View style={{ width: targetSize * 0.45, height: targetSize * 0.45, borderRadius: (targetSize * 0.45) / 2, backgroundColor: '#BC002D' }} />
          </View>
        );

      case 'us':
        return (
          <View style={[styles.fallbackContainer, { width: targetSize, height: targetSize, backgroundColor: '#FFFFFF' }]}>
            {/* Red & white stripes */}
            <View style={styles.stripeContainer}>
              {[...Array(7)].map((_, i) => (
                <View
                  key={i}
                  style={{
                    height: targetSize / 13,
                    backgroundColor: i % 2 === 0 ? '#B22234' : '#FFFFFF',
                    width: '100%',
                  }}
                />
              ))}
            </View>
            {/* Blue Canton */}
            <View style={[styles.cantonUs, { width: targetSize * 0.5, height: targetSize * 0.5 }]}>
              <Text style={{ fontSize: targetSize * 0.25, color: '#FFFFFF', lineHeight: targetSize * 0.4, textAlign: 'center' }}>★</Text>
            </View>
          </View>
        );

      case 'scotland':
        return (
          <View style={[styles.fallbackContainer, { width: targetSize, height: targetSize, backgroundColor: '#005EB8' }]}>
            {/* Diagonal White Cross */}
            <View style={[styles.saltireLine, { transform: [{ rotate: '45deg' }], width: targetSize * 1.4, height: targetSize * 0.12 }]} />
            <View style={[styles.saltireLine, { transform: [{ rotate: '-45deg' }], width: targetSize * 1.4, height: targetSize * 0.12 }]} />
          </View>
        );

      case 'ma':
        return (
          <View style={[styles.fallbackContainer, { width: targetSize, height: targetSize, backgroundColor: '#C1272D', justifyContent: 'center', alignItems: 'center' }]}>
            {/* Green Pentagram */}
            <Text style={{ color: '#006233', fontSize: targetSize * 0.75, fontWeight: 'bold', top: -targetSize * 0.05 }}>★</Text>
          </View>
        );

      case 'au':
        return (
          <View style={[styles.fallbackContainer, { width: targetSize, height: targetSize, backgroundColor: '#00008B' }]}>
            {/* Union Jack approx corner */}
            <View style={[styles.cantonAu, { width: targetSize * 0.5, height: targetSize * 0.4 }]}>
              <View style={{ backgroundColor: '#FFFFFF', width: '100%', height: '20%', position: 'absolute', top: '40%' }} />
              <View style={{ backgroundColor: '#FFFFFF', width: '20%', height: '100%', position: 'absolute', left: '40%' }} />
              <View style={{ backgroundColor: '#FF0000', width: '100%', height: '10%', position: 'absolute', top: '45%' }} />
              <View style={{ backgroundColor: '#FF0000', width: '10%', height: '100%', position: 'absolute', left: '45%' }} />
            </View>
            {/* A few dots for Southern Cross */}
            <View style={[styles.starAu, { right: targetSize * 0.2, top: targetSize * 0.25 }]} />
            <View style={[styles.starAu, { right: targetSize * 0.15, top: targetSize * 0.5 }]} />
            <View style={[styles.starAu, { right: targetSize * 0.35, top: targetSize * 0.4 }]} />
            <View style={[styles.starAu, { right: targetSize * 0.25, bottom: targetSize * 0.15 }]} />
          </View>
        );

      default: {
        // Automatically try to extract country flag code from teamName or countryCode
        let isoCode = '';
        if (cleanCode.length === 2) isoCode = cleanCode;
        else if (cleanName.includes('camer') || cleanName.includes('garoua') || cleanName.includes('yaounde') || cleanName.includes('douala')) isoCode = 'cm';
        else if (cleanName.includes('ivoir') || cleanName.includes('abidjan')) isoCode = 'ci';
        else if (cleanName.includes('seneg') || cleanName.includes('dakar')) isoCode = 'sn';
        else if (cleanName.includes('maroc') || cleanName.includes('casablanca') || cleanName.includes('rabat')) isoCode = 'ma';
        else if (cleanName.includes('alger') || cleanName.includes('oran')) isoCode = 'dz';
        else if (cleanName.includes('tunis')) isoCode = 'tn';
        else if (cleanName.includes('egyp') || cleanName.includes('cairo')) isoCode = 'eg';
        else if (cleanName.includes('congo') || cleanName.includes('kinshasa')) isoCode = 'cd';
        else if (cleanName.includes('france') || cleanName.includes('paris') || cleanName.includes('marseille') || cleanName.includes('lyon')) isoCode = 'fr';
        else if (cleanName.includes('espag') || cleanName.includes('madrid') || cleanName.includes('barcelone')) isoCode = 'es';
        else if (cleanName.includes('allem') || cleanName.includes('munich')) isoCode = 'de';
        else if (cleanName.includes('anglet') || cleanName.includes('london') || cleanName.includes('manchester')) isoCode = 'gb';
        else if (cleanName.includes('ital')) isoCode = 'it';
        else if (cleanName.includes('bresil')) isoCode = 'br';
        else if (cleanName.includes('argent')) isoCode = 'ar';

        if (isoCode) {
          return (
            <Image
              source={`https://flagcdn.com/w320/${isoCode}.png`}
              style={{ width: targetSize, height: targetSize, borderRadius: targetSize / 2 }}
              contentFit="cover"
            />
          );
        }

        return (
          <View style={[styles.fallbackContainer, { width: targetSize, height: targetSize, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center' }]}>
            <Text style={{ color: '#FFFFFF', fontSize: targetSize * 0.4, fontWeight: 'bold' }}>
              {(teamName || 'FC').charAt(0).toUpperCase()}
            </Text>
          </View>
        );
      }
    }
  };

  const cleanName = (teamName || '').toLowerCase().trim();
  const cleanCode = (countryCode || '').toLowerCase().trim();

  const isExplicitUrl = (countryCode || '').startsWith('http');
  const isMortalFighter = cleanCode.startsWith('mortal:');
  const isCountryFlag = !isExplicitUrl && (
    cleanCode.length === 2 ||
    Boolean(LOCAL_COUNTRY_FLAGS[cleanCode]) ||
    ['us', 'au', 'scotland', 'ma', 'tn', 'jp', 'be'].includes(cleanCode)
  );

  const zoomFactor = isCountryFlag ? 1.65 : 1.0;
  const imageSize = size * zoomFactor;
  const resolvedLogoUrl = isExplicitUrl ? resolveOnlineTeamLogo(countryCode) : null;
  const showImage = !hasError && (isCountryFlag || isMortalFighter || resolvedLogoUrl !== null);

  if (!isCountryFlag) {
    return (
      <View style={{ width: size, height: size, borderRadius: isMortalFighter ? size * 0.22 : 0, overflow: isMortalFighter ? 'hidden' : 'visible', justifyContent: 'center', alignItems: 'center' }}>
        {showImage ? (
          <Image
            source={getFlagUrl(resolvedLogoUrl || countryCode)}
            style={{ width: size, height: size, borderRadius: isMortalFighter ? size * 0.22 : 0 }}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
            onError={() => setHasError(true)}
          />
        ) : (
          renderFallback(size)
        )}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' }}>
      <View style={{
        width: imageSize,
        height: imageSize,
        borderRadius: imageSize / 2,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {!hasError ? (
          <Image
            source={getFlagUrl(countryCode)}
            style={{ width: imageSize, height: imageSize }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            onError={() => setHasError(true)}
          />
        ) : (
          getLocalCountryFlag(cleanCode) ? (
            <Image
              source={getLocalCountryFlag(cleanCode)}
              style={{ width: imageSize, height: imageSize }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={0}
            />
          ) : renderFallback(imageSize)
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shadowWrapper: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2.5 },
    shadowOpacity: 0.3,
    shadowRadius: 3.5,
    elevation: 4,
    backgroundColor: 'transparent',
  },
  container: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fallbackContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    position: 'relative',
  },
  stripeContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  cantonUs: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#3C3B6E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saltireLine: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    top: '44%',
  },
  cantonAu: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#002B7F',
    overflow: 'hidden',
  },
  starAu: {
    position: 'absolute',
    width: 2.5,
    height: 2.5,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  glossHighlight: {
    position: 'absolute',
    top: '4%',
    left: '12%',
    width: '60%',
    height: '35%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.48)',
  },
  bottomDarkening: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '42%',
    backgroundColor: 'rgba(0, 0, 0, 0.13)',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
  },
  bottomHighlight: {
    position: 'absolute',
    bottom: '6%',
    right: '16%',
    width: '28%',
    height: '16%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  bevelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    borderWidth: 1.2,
    borderColor: 'rgba(0, 0, 0, 0.2)',
  },
});
