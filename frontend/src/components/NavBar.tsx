import {
    IconLibraryPhoto,
    IconPhotoScan,
    IconHome2,
    IconLogout,
    IconSettings,
    IconShieldLock,
    IconProps,
} from '@tabler/icons-react';
import { Flex, Stack, Tooltip, UnstyledButton } from '@mantine/core';
import styles from './NavBar.module.scss';
import { act, useEffect, useState } from 'react';
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

interface Page {
    label: string,
    url: string,
    icon: typeof IconHome2,
    page: any,
  }

interface NavBarProps {
    pages: Page[],
    activePage: string
}

function NavBar({ activePage, pages }: NavBarProps) {
    const { logout } = useAuth();

    const [activeURL, setActiveURL] = useState(activePage);
    const [page, setPage] = useState();

    const links = pages.map((obj) => {
        return <NavbarLink
            icon={obj.icon}
            label={obj.label}
            key={obj.label}
            active={activeURL === obj.url}
            onClick={() => {
                setActiveURL(obj.url);
                setPage(obj.page);
            }}
        />

    })

    return (
        <Flex>
            <nav className={styles.navbar}>
                <div className={styles.navbarMain}>
                    <Stack justify="center" gap={0}>
                        {links}
                    </Stack>
                </div>

                <Stack justify="center" gap={0}>
                    <NavbarLink icon={IconLogout} label="Logout" onClick={() => logout()} />
                </Stack>
            </nav>
            {page}
        </Flex>
    )
}

export default NavBar;