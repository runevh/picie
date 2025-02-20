import {
    IconLibraryPhoto,
    IconPhotoScan,
    IconHome2,
    IconLogout,
    IconSettings,
    IconShieldLock,
} from '@tabler/icons-react';
import { Stack, Tooltip, UnstyledButton } from '@mantine/core';
import styles from './NavBar.module.scss';
import { useState } from 'react';
import { useAuth } from '../contexts/UserContext';

interface NavbarLinkProps {
    icon: typeof IconHome2;
    label: string;
    active?: boolean;
    onClick?: () => void;
}  

function NavbarLink({ icon: Icon, label, active, onClick }: NavbarLinkProps) {
    return (
        <Tooltip label={label} position="right" transitionProps={{ duration: 0 }}>
            <UnstyledButton onClick={onClick} className={styles.link} data-active={active || undefined}>
                <Icon size={20} stroke={1.5} />
            </UnstyledButton>
        </Tooltip>
    );
}

const mockdata = [
    { icon: IconHome2, label: 'Home' },
    { icon: IconLibraryPhoto, label: 'Photo Collages' },
    { icon: IconPhotoScan, label: 'Devices' },
    { icon: IconSettings, label: 'Settings' },
];

interface NavBarProps {
    active: number
}

function NavBar({active: number}: NavBarProps) {
    const { logout, user } = useAuth();

    const [active, setActive] = useState(number);

    const linksData = user?.admin 
        ? [...mockdata, { icon: IconShieldLock, label: 'Admin' }]  // Add 'Admin' link
        : mockdata;

    const links = linksData.map((link, index) => (
        <NavbarLink
            {...link}
            key={link.label}
            active={index === active}
            onClick={() => setActive(index)}
        />
    ));

    return (
        <nav className={styles.navbar}>
            <div className={styles.navbarMain}>
                <Stack justify="center" gap={0}>
                    {links}
                </Stack>
            </div>

            <Stack justify="center" gap={0}>
                <NavbarLink icon={IconLogout} label="Logout" onClick={() => logout()}/>
            </Stack>
        </nav>
    )
}

export default NavBar;