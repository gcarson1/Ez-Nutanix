// Vendor logos (N2-044): each on a white plate so it keeps its colors and clear space in both
// themes. Sources and dates are in src/assets/logos/README.md. A vendor without a clean SVG
// (Everpure) shows its name in text on the same plate; logos are never redrawn by hand.
import cisco from '../../assets/logos/cisco.svg';
import dell from '../../assets/logos/dell.svg';
import fujitsu from '../../assets/logos/fujitsu.svg';
import hpe from '../../assets/logos/hpe.svg';
import lenovo from '../../assets/logos/lenovo.svg';
import netapp from '../../assets/logos/netapp.svg';
import nutanix from '../../assets/logos/nutanix.svg';
import supermicro from '../../assets/logos/supermicro.svg';

export type Vendor = 'Nutanix' | 'Dell' | 'HPE' | 'Lenovo' | 'Cisco' | 'Fujitsu' | 'Supermicro' | 'NetApp' | 'Everpure';

export const LOGOS: Record<Vendor, string | null> = {
  Nutanix: nutanix,
  Dell: dell,
  HPE: hpe,
  Lenovo: lenovo,
  Cisco: cisco,
  Fujitsu: fujitsu,
  Supermicro: supermicro,
  NetApp: netapp,
  Everpure: null,
};

/** Height multipliers so compact marks (a circle, an oval) look as tall as long wordmarks. */
export const LOGO_SCALE: Record<Vendor, number> = { Nutanix: 0.85, Dell: 1.5, HPE: 1.35, Lenovo: 1, Cisco: 1.35, Fujitsu: 1.3, Supermicro: 1.5, NetApp: 0.95, Everpure: 1 };

/** A vendor mark on a light plate; `size` sets the optical height (tile 20 px, table 14 px). */
export function Logo({ vendor, size = 'tile' }: { vendor: Vendor; size?: 'tile' | 'table' }) {
  const src = LOGOS[vendor];
  return (
    <span class={`logo-plate ${size}`} style={{ '--s': LOGO_SCALE[vendor] }}>
      {src ? <img src={src} alt={vendor} /> : <span class="logo-text">{vendor}</span>}
    </span>
  );
}
