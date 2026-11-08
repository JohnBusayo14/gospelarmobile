// Must stay the first import: routes API calls across api / api2.gospelar.com.
import './services/apiFailover';
import { registerRootComponent } from 'expo';

import App from './App';
import { withUpdateGate } from './components/UpdateGate';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
// UpdateGate forces over-the-air updates: when EAS has a newer update it
// covers the app, downloads it and restarts (see components/UpdateGate.jsx).
registerRootComponent(withUpdateGate(App));
