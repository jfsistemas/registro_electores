const handleNavBar = () => {
    /* Manejo del NavBar */
    document.getElementById('mobile-menu-btn').onclick = () => {
        document.getElementById('mobile-menu').classList.toggle('hidden');
        document.getElementById('hamburger-icon').classList.toggle('hidden');
        document.getElementById('close-icon').classList.toggle('hidden');
    };
}

export { handleNavBar }