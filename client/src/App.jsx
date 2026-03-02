import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { useContext } from 'react';
import Login from './pages/Login';
import Home from './pages/Home';
import PendingListings from './pages/PendingListings';
import SavedListings from './pages/SavedListings';
import Admin from './pages/Admin';
import Regions from './pages/Regions';
import EfdalAI from './pages/EfdalAI';
import Announcements from './pages/Announcements';
import Appointments from './pages/Appointments';
import ActivityFeed from './pages/ActivityFeed';
import Trash from './pages/Trash';
import Demands from './pages/Demands';
import Settings from './pages/Settings';
import Layout from './components/Layout';

const ProtectedRoute = ({ children }) => {
    const { token, loading } = useContext(AuthContext);
    if (loading) return <div className="min-h-screen flex items-center justify-center animate-pulse">Yükleniyor...</div>;
    if (!token) return <Navigate to="/login" replace />;
    return <Layout>{children}</Layout>;
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route
                        path="/home"
                        element={
                            <ProtectedRoute>
                                <Home />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/sayfalar/onay-bekleyenler"
                        element={
                            <ProtectedRoute>
                                <PendingListings />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/sayfalar/kaydedilenler"
                        element={
                            <ProtectedRoute>
                                <SavedListings />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/sayfalar/silinenler"
                        element={
                            <ProtectedRoute>
                                <Trash />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/sayfalar/bolgeler"
                        element={
                            <ProtectedRoute>
                                <Regions />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/efdal-ai"
                        element={
                            <ProtectedRoute>
                                <EfdalAI />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/sayfalar/duyurular"
                        element={
                            <ProtectedRoute>
                                <Announcements />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/admin"
                        element={
                            <ProtectedRoute>
                                <Admin />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/sayfalar/randevular"
                        element={
                            <ProtectedRoute>
                                <Appointments />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/sayfalar/talepler"
                        element={
                            <ProtectedRoute>
                                <Demands />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/sayfalar/aktivite"
                        element={
                            <ProtectedRoute>
                                <ActivityFeed />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/ayarlar"
                        element={
                            <ProtectedRoute>
                                <Settings />
                            </ProtectedRoute>
                        }
                    />
                    <Route path="/" element={<Navigate to="/home" replace />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
