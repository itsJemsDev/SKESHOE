// World coordinates are shared by the scene, destination list, minimap and server bounds.
export const CAMPUS_RADIUS = 52;
export const CAMPUS_BOUNDS = Object.freeze({ minX: -CAMPUS_RADIUS, maxX: CAMPUS_RADIUS, minZ: -CAMPUS_RADIUS, maxZ: CAMPUS_RADIUS });

export const CAMPUS_PLACES = Object.freeze([
  { id: 'library', title: 'Campus library', short: 'Library', subtitle: 'Study, make, and discover', icon: '📚', district: 'North campus', x: 12, z: -28, arrival: [7.5, -28], interactionRadius: 4.6 },
  { id: 'ccso', title: 'CCSO Building', short: 'CCSO', subtitle: 'Academics & innovation hub', icon: '🖥️', district: 'Central campus', x: -6.5, z: -14, arrival: [-3.0, -14], interactionRadius: 4.6 },
  { id: 'cafe', title: 'Student commons', short: 'Commons', subtitle: 'Café, lounge & good chats', icon: '☕', district: 'Commercial district', x: 17, z: -11, arrival: [13, -6], interactionRadius: 4.6 },
  { id: 'sports', title: 'Pickleball court', short: 'Pickleball', subtitle: 'Games & friendly matches', icon: '🏓', district: 'Recreation district', x: -17, z: -11, arrival: [-11.5, -7.5], interactionRadius: 7.5 },
  { id: 'park', title: 'Botanical garden', short: 'Garden', subtitle: 'A breath between classes', icon: '🌱', district: 'Nature district', x: -20, z: 13, arrival: [-17, 10], interactionRadius: 4.6 },
  { id: 'stage', title: 'Arts pavilion', short: 'Arts pavilion', subtitle: 'Shows, clubs & campus events', icon: '🎶', district: 'Creative district', x: 20, z: 13, arrival: [13, 12], interactionRadius: 4.6 },
  { id: 'residence', title: 'Residence hall', short: 'Residence', subtitle: 'Find your campus home', icon: '🏡', district: 'Residential district', x: 32, z: -22, arrival: [37, -8], interactionRadius: 4.6 },
  { id: 'transit', title: 'Campus transit', short: 'Transit', subtitle: 'Arrive, depart, explore', icon: '🚌', district: 'Transportation district', x: 28, z: 0, arrival: [22.0, 4.0], interactionRadius: 4.6 },
]);
