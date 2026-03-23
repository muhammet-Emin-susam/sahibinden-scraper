import { createContext, useState, useEffect, useRef } from 'react';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const logoutRef = useRef(null);

    useEffect(() => {
        // Load token from localStorage
        const storedToken = localStorage.getItem('sahibinden_token');
        const storedUser = localStorage.getItem('sahibinden_user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    // Global fetch interceptor — auto logout when account is deleted server-side
    useEffect(() => {
        const originalFetch = window.fetch;

        window.fetch = async (...args) => {
            try {
                const response = await originalFetch.apply(window, args);

                if (response.status === 401) {
                    const clone = response.clone();
                    try {
                        const data = await clone.json();
                        if (data.error === 'USER_DELETED' && logoutRef.current) {
                            logoutRef.current();
                        }
                    } catch (_) { }
                }

                return response;
            } catch (err) {
                console.error(`Fetch error for ${args[0]}:`, err);
                throw err;
            }
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('sahibinden_token');
        localStorage.removeItem('sahibinden_user');
    };

    // Keep ref up-to-date so the fetch interceptor always calls the latest logout
    logoutRef.current = logout;

    const login = (newToken, newUser) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('sahibinden_token', newToken);
        localStorage.setItem('sahibinden_user', JSON.stringify(newUser));
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
