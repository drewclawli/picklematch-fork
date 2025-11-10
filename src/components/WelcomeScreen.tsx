import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Users, Clock, Zap, Smartphone, BarChart3 } from "lucide-react";

interface WelcomeScreenProps {
  onGetStarted: () => void;
}

export const WelcomeScreen = ({ onGetStarted }: WelcomeScreenProps) => {
  const features = [
    {
      icon: <Users className="w-6 h-6" />,
      title: "Smart Team Rotation",
      description: "Automated fair team pairing for pickleball, tennis, badminton & racket sports"
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Live Match Scheduling",
      description: "Real-time schedule updates and match timers across all devices"
    },
    {
      icon: <Trophy className="w-6 h-6" />,
      title: "Game Scoring & Stats",
      description: "Track scores, leaderboards, and player performance instantly"
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "60-Second Setup",
      description: "No account needed - create games with a simple code in seconds"
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "Multi-Device Sync",
      description: "Players join on their phones for live match notifications"
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "Tournament Ready",
      description: "Perfect for round-robin tournaments and casual social play"
    }
  ];

  const useCases = [
    "Pickleball round-robin tournaments",
    "Tennis club social mixers",
    "Badminton group sessions",
    "Recreational racket sports leagues",
    "Casual pickup games with friends",
    "Multi-court rotation events"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl space-y-8 animate-in fade-in duration-700">
        {/* Hero Section */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            TeamUp Scheduler
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Free Round-Robin Tournament & Team Rotation Manager for Pickleball, Tennis & Racket Sports
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-sm text-muted-foreground">
            <span>🏓 Pickleball</span>
            <span>•</span>
            <span>🎾 Tennis</span>
            <span>•</span>
            <span>🏸 Badminton</span>
            <span>•</span>
            <span>🎯 Racquetball</span>
            <span>•</span>
            <span>🏓 Table Tennis</span>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="p-4 hover:shadow-lg transition-all duration-300 hover:scale-105 bg-card/80 backdrop-blur-sm border-primary/10"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  {feature.icon}
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Use Cases Section */}
        <Card className="p-6 bg-card/80 backdrop-blur-sm border-primary/10">
          <h2 className="text-xl font-bold mb-4 text-center">Perfect For</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {useCases.map((useCase, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span>{useCase}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* CTA Section */}
        <div className="text-center space-y-4">
          <Button 
            onClick={onGetStarted}
            size="lg"
            className="text-lg px-12 py-6 h-auto font-bold bg-gradient-to-r from-primary to-accent hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            Let's Play! 🎾
          </Button>
          <p className="text-sm text-muted-foreground">
            100% Free • No Account Required • Instant Setup
          </p>
        </div>

        {/* SEO Keywords Footer */}
        <div className="text-center text-xs text-muted-foreground/60 space-y-1 pt-4">
          <p>
            Free pickleball scheduler | Tennis round robin generator | Badminton tournament manager
          </p>
          <p>
            Team rotation app | Court scheduling software | Sports league organizer
          </p>
        </div>
      </div>
    </div>
  );
};