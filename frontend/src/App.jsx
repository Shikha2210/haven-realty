import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { PortalLayout, PublicLayout } from './components/Layouts.jsx';
import { Spinner } from './components/ui.jsx';

import Home from './pages/Home.jsx';
import Browse from './pages/Browse.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import Compare from './pages/Compare.jsx';
import { Login, Signup, Forgot } from './pages/Auth.jsx';

const CustomerDashboard = lazy(() => import('./pages/customer/Dashboard.jsx'));
const Wishlist = lazy(() => import('./pages/customer/Wishlist.jsx'));
const Enquiries = lazy(() => import('./pages/customer/Enquiries.jsx'));
const Profile = lazy(() => import('./pages/customer/Profile.jsx'));
const SellerApplication = lazy(() => import('./pages/customer/SellerApplication.jsx'));
const VerifyPage = lazy(() => import('./pages/customer/VerifyPage.jsx'));
const SellerDashboard = lazy(() => import('./pages/seller/Dashboard.jsx'));
const SellerProperties = lazy(() => import('./pages/seller/Properties.jsx'));
const PropertyForm = lazy(() => import('./pages/seller/PropertyForm.jsx'));
const SellerMessages = lazy(() => import('./pages/seller/Messages.jsx'));
const AgentDashboard = lazy(() => import('./pages/agent/Dashboard.jsx'));
const AgentEnquiries = lazy(() => import('./pages/agent/Enquiries.jsx'));
const AgentProperties = lazy(() => import('./pages/agent/Properties.jsx'));
const AgentVerifications = lazy(() => import('./pages/agent/Verifications.jsx'));
const AgentCustomers = lazy(() => import('./pages/agent/Customers.jsx'));
const AgentSales = lazy(() => import('./pages/agent/Sales.jsx'));
const AgentRentals = lazy(() => import('./pages/agent/Rentals.jsx'));
const AgentAudit = lazy(() => import('./pages/agent/Audit.jsx'));

/** Client-side guard for UX only. The real enforcement is on the server for every API call. */
function Guard({ role, seller, children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  if (user.role !== role) return <Navigate to={user.role === 'AGENT' ? '/agent' : '/account'} replace />;
  if (seller && !user.sellerEnabled) return <Navigate to="/account/seller-application" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/properties" element={<Browse />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<Forgot />} />
        </Route>

        <Route element={<Guard role="CUSTOMER"><PortalLayout mode="buyer" /></Guard>}>
          <Route path="/account" element={<CustomerDashboard />} />
          <Route path="/account/wishlist" element={<Wishlist />} />
          <Route path="/account/enquiries" element={<Enquiries />} />
          <Route path="/account/enquiries/:id" element={<Enquiries />} />
          <Route path="/account/profile" element={<Profile />} />
          <Route path="/account/verify" element={<VerifyPage />} />
          <Route path="/account/seller-application" element={<SellerApplication />} />
        </Route>

        <Route element={<Guard role="CUSTOMER" seller><PortalLayout mode="seller" /></Guard>}>
          <Route path="/seller" element={<SellerDashboard />} />
          <Route path="/seller/properties" element={<SellerProperties />} />
          <Route path="/seller/properties/new" element={<PropertyForm />} />
          <Route path="/seller/properties/:id" element={<PropertyForm />} />
          <Route path="/seller/messages" element={<SellerMessages />} />
        </Route>

        <Route element={<Guard role="AGENT"><PortalLayout mode="agent" /></Guard>}>
          <Route path="/agent" element={<AgentDashboard />} />
          <Route path="/agent/enquiries" element={<AgentEnquiries />} />
          <Route path="/agent/enquiries/:id" element={<AgentEnquiries />} />
          <Route path="/agent/properties" element={<AgentProperties />} />
          <Route path="/agent/properties/:id" element={<AgentProperties />} />
          <Route path="/agent/verifications" element={<AgentVerifications />} />
          <Route path="/agent/customers" element={<AgentCustomers />} />
          <Route path="/agent/customers/:id" element={<AgentCustomers />} />
          <Route path="/agent/sales" element={<AgentSales />} />
          <Route path="/agent/rentals" element={<AgentRentals />} />
          <Route path="/agent/audit" element={<AgentAudit />} />
        </Route>

        <Route path="*" element={<div className="grid min-h-[60vh] place-items-center text-center"><div><p className="font-display text-5xl text-navy-900">404</p><p className="mt-2 text-muted">That page doesn’t exist.</p></div></div>} />
      </Routes>
    </Suspense>
  );
}
