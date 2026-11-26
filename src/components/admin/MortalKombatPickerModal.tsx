import React, { useMemo, useState } from 'react';
import { FlatList, Image, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AT } from '@/constants/adminTheme';

export type MortalKombatFighter = { name: string; key: string; image: any };

const fighterImage = {
  baraka: require('../../../assets/images/mortal-kombat/fighters-cutout/baraka.png'), 'cassie-cage': require('../../../assets/images/mortal-kombat/fighters-cutout/cassie-cage.png'), cetrion: require('../../../assets/images/mortal-kombat/fighters-cutout/cetrion.png'), 'd-vorah': require('../../../assets/images/mortal-kombat/fighters-cutout/d-vorah.png'), 'erron-black': require('../../../assets/images/mortal-kombat/fighters-cutout/erron-black.png'),
  frost: require('../../../assets/images/mortal-kombat/fighters-cutout/frost.png'), geras: require('../../../assets/images/mortal-kombat/fighters-cutout/geras.png'), fujin: require('../../../assets/images/mortal-kombat/fighters-cutout/fujin.png'), 'jaqui-briggs': require('../../../assets/images/mortal-kombat/fighters-cutout/jaqui-briggs.png'), jade: require('../../../assets/images/mortal-kombat/fighters-cutout/jade.png'),
  'jax-briggs': require('../../../assets/images/mortal-kombat/fighters-cutout/jax-briggs.png'), 'johnny-cage': require('../../../assets/images/mortal-kombat/fighters-cutout/johnny-cage.png'), joker: require('../../../assets/images/mortal-kombat/fighters-cutout/joker.png'), kabal: require('../../../assets/images/mortal-kombat/fighters-cutout/kabal.png'), kano: require('../../../assets/images/mortal-kombat/fighters-cutout/kano.png'),
  kitana: require('../../../assets/images/mortal-kombat/fighters-cutout/kitana.png'), kollector: require('../../../assets/images/mortal-kombat/fighters-cutout/kollector.png'), 'kotal-kahn': require('../../../assets/images/mortal-kombat/fighters-cutout/kotal-kahn.png'), 'kung-lao': require('../../../assets/images/mortal-kombat/fighters-cutout/kung-lao.png'), 'liu-kang': require('../../../assets/images/mortal-kombat/fighters-cutout/liu-kang.png'),
  mileena: require('../../../assets/images/mortal-kombat/fighters-cutout/mileena.png'), nightwolf: require('../../../assets/images/mortal-kombat/fighters-cutout/nightwolf.png'), 'noob-saibot': require('../../../assets/images/mortal-kombat/fighters-cutout/noob-saibot.png'), raiden: require('../../../assets/images/mortal-kombat/fighters-cutout/raiden.png'), rain: require('../../../assets/images/mortal-kombat/fighters-cutout/rain.png'),
  rambo: require('../../../assets/images/mortal-kombat/fighters-cutout/rambo.png'), robocop: require('../../../assets/images/mortal-kombat/fighters-cutout/robocop.png'), scorpion: require('../../../assets/images/mortal-kombat/fighters-cutout/scorpion.png'), 'shang-tsung': require('../../../assets/images/mortal-kombat/fighters-cutout/shang-tsung.png'), 'shao-kahn': require('../../../assets/images/mortal-kombat/fighters-cutout/shao-kahn.png'),
  sheeva: require('../../../assets/images/mortal-kombat/fighters-cutout/sheeva.png'), sindel: require('../../../assets/images/mortal-kombat/fighters-cutout/sindel.png'), skarlet: require('../../../assets/images/mortal-kombat/fighters-cutout/skarlet.png'), 'sonya-blade': require('../../../assets/images/mortal-kombat/fighters-cutout/sonya-blade.png'), spawn: require('../../../assets/images/mortal-kombat/fighters-cutout/spawn.png'),
  'sub-zero': require('../../../assets/images/mortal-kombat/fighters-cutout/sub-zero.png'), 'terminator-t-800': require('../../../assets/images/mortal-kombat/fighters-cutout/terminator-t-800.png'),
} as const;

export const MORTAL_KOMBAT_FIGHTERS: MortalKombatFighter[] = [
  ['Baraka', 'baraka'], ['Cassie Cage', 'cassie-cage'], ['Cetrion', 'cetrion'], ['D’Vorah', 'd-vorah'], ['Erron Black', 'erron-black'],
  ['Frost', 'frost'], ['Geras', 'geras'], ['Fujin', 'fujin'], ['Jacqui Briggs', 'jaqui-briggs'], ['Jade', 'jade'], ['Jax Briggs', 'jax-briggs'],
  ['Johnny Cage', 'johnny-cage'], ['Joker', 'joker'], ['Kabal', 'kabal'], ['Kano', 'kano'], ['Kitana', 'kitana'], ['Kollector', 'kollector'],
  ['Kotal Kahn', 'kotal-kahn'], ['Kung Lao', 'kung-lao'], ['Liu Kang', 'liu-kang'], ['Mileena', 'mileena'], ['Nightwolf', 'nightwolf'],
  ['Noob Saibot', 'noob-saibot'], ['Raiden', 'raiden'], ['Rain', 'rain'], ['Rambo', 'rambo'], ['RoboCop', 'robocop'], ['Scorpion', 'scorpion'],
  ['Shang Tsung', 'shang-tsung'], ['Shao Kahn', 'shao-kahn'], ['Sheeva', 'sheeva'], ['Sindel', 'sindel'], ['Skarlet', 'skarlet'],
  ['Sonya Blade', 'sonya-blade'], ['Spawn', 'spawn'], ['Sub-Zero', 'sub-zero'], ['Terminator T-800', 'terminator-t-800'],
].map(([name, key]) => ({ name, key, image: fighterImage[key as keyof typeof fighterImage] }));

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSelect: (fighter: MortalKombatFighter) => void;
}

export function MortalKombatPickerModal({ visible, title, onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? MORTAL_KOMBAT_FIGHTERS.filter((fighter) => fighter.name.toLowerCase().includes(q)) : MORTAL_KOMBAT_FIGHTERS;
  }, [query]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.back}><Ionicons name="arrow-back" size={22} color="#FFF" /></TouchableOpacity>
          <View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>Choisir un combattant</Text></View>
        </View>
        <View style={styles.search}><Ionicons name="search" size={17} color={AT.textMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Rechercher un combattant" placeholderTextColor={AT.textMuted} style={styles.searchInput} /></View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.key}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => { onSelect(item); onClose(); }} activeOpacity={0.8}>
              <Image source={item.image} style={styles.image} resizeMode="cover" />
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F7FB' },
  header: { backgroundColor: '#173A61', paddingTop: 48, paddingHorizontal: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  title: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  subtitle: { color: '#D6E5F5', fontSize: 11, marginTop: 2 },
  search: { margin: 12, paddingHorizontal: 12, minHeight: 42, borderRadius: 9, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DFE7F0', flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, color: '#173A61', fontSize: 13 },
  grid: { padding: 8, gap: 8 },
  card: { flex: 1, margin: 4, minHeight: 132, borderRadius: 10, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', padding: 6, alignItems: 'center' },
  image: { width: '100%', height: 92, borderRadius: 7 },
  name: { color: '#173A61', fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 6 },
});
