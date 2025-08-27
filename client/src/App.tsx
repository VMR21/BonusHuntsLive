import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/navigation";
import HuntsPage from "@/pages/hunts";
import HuntDetailPage from "@/pages/hunt-detail";
import AdminPage from "@/pages/admin";
import OBSOverlayPage from "@/pages/obs-overlay";
import LiveOBSOverlay from "@/pages/live-obs-overlay";
import OBSLiveBonusesPage from "@/pages/obs-live-bonuses";
import LatestHuntPage from "@/pages/latest-hunt";
import PublicHuntPage from "@/pages/public-hunt";
import LiveHuntsPage from "@/pages/live";
import LatestHuntOverlay from "@/pages/latest-hunt-overlay";
import SlotPickerPage from "@/pages/slot-picker";
import TournamentPage from "@/pages/tournament";

import AdminKeys from "@/pages/AdminKeys";
import Profile from "@/pages/Profile";
import Raffles from "@/pages/raffles";
import RaffleOverlay from "@/pages/raffle-overlay";
import RaffleCommandPage from "@/pages/raffle-command";
import OBSOverlaysPage from "@/pages/obs-overlays";
import BottomBarOverlay from "@/pages/bottom-bar-overlay";
import AdminOverlay from "@/pages/admin-overlay";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HuntsPage} />
      <Route path="/live" component={LiveHuntsPage} />
      <Route path="/slot-picker" component={SlotPickerPage} />
      <Route path="/tournament" component={TournamentPage} />
      <Route path="/raffles" component={Raffles} />
      <Route path="/obs-overlays" component={OBSOverlaysPage} />
      <Route path="/raffle-overlay/:id" component={RaffleOverlay} />
      <Route path="/raffle/:id" component={RaffleCommandPage} />

      <Route path="/admin-keys" component={AdminKeys} />
      <Route path="/profile" component={Profile} />
      <Route path="/hunts/:id" component={HuntDetailPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/obs" component={OBSOverlayPage} />
      <Route path="/obs-v2" component={OBSOverlayPage} />
      <Route path="/obs-overlay/:id" component={LiveOBSOverlay} />
      <Route path="/live-obs-overlay" component={LiveOBSOverlay} />
      <Route path="/latest-hunt-overlay" component={LatestHuntOverlay} />
      <Route path="/bottom-bar-overlay" component={BottomBarOverlay} />
      <Route path="/overlay/:adminKey" component={AdminOverlay} />
      <Route path="/live-bonus-hunt" component={OBSLiveBonusesPage} />
      <Route path="/latest-hunt" component={LatestHuntPage} />
      <Route path="/public/:token" component={PublicHuntPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-dark text-gray-100">
          <Switch>
            <Route path="/obs*" component={() => <Router />} />
            <Route path="/latest-hunt-overlay" component={() => <Router />} />
            <Route path="/bottom-bar-overlay" component={() => <Router />} />
            <Route path="/overlay/*" component={() => <Router />} />
            <Route path="/live-bonus-hunt" component={() => <Router />} />
            <Route path="/public*" component={() => <Router />} />
            <Route>
              <Navigation />
              <Router />
            </Route>
          </Switch>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
