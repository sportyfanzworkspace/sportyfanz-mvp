"use client";

import {
  CircleDollarSign,
  Gift,
  Package,
  Radio,
  ShoppingBag,
  Ticket,
  Loader2,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import { useEffect, useState } from "react";

type Reward = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  pointsCost: number;
  stock: number | null;
  status: string;
  category: string | null;
  expiresAt: string | null;
};

type Redemption = {
  id: number;
  rewardId: number;
  rewardName: string;
  pointsSpent: number;
  status: string;
  rejectionReason: string | null;
  referenceCode: string;
  createdAt: string;
  fulfilledAt: string | null;
};

type RewardsResponse = {
  balance: number;
  totalPoints: number;
  fanLevel: string;
  rewards: Reward[];
  history: Redemption[];
};

const iconMap = [
  Ticket,
  Package,
  ShoppingBag,
  Gift,
  Radio,
];

function getRewardIcon(index: number) {
  return iconMap[index % iconMap.length];
}

function formatPoints(points: number) {
  return new Intl.NumberFormat("en-US").format(points);
}

function getRewardDescription(reward: Reward) {
  if (reward.description) {
    return reward.description;
  }

  if (reward.category) {
    return reward.category;
  }

  return "SportyFanz reward";
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function RewardPage() {
  const [activeTab, setActiveTab] = useState<
    "available" | "mine" | "history"
  >("available");

  const [data, setData] = useState<RewardsResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadRewards() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/rewards", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load rewards"
        );
      }

      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load rewards"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRewards();
  }, []);

  async function handleRedeem(rewardId: number) {
    try {
      setRedeemingId(rewardId);
      setMessage("");
      setError("");

      const response = await fetch(
        "/api/rewards/redeem",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rewardId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to redeem reward"
        );
      }

      setMessage(
        `${result.redemption.rewardName} redeemed successfully. Reference: ${result.redemption.referenceCode}`
      );

      await loadRewards();

      setActiveTab("mine");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to redeem reward"
      );
    } finally {
      setRedeemingId(null);
    }
  }

  const rewards = data?.rewards ?? [];
  const history = data?.history ?? [];

  const availableRewards = rewards.filter(
    (reward) =>
      reward.status === "ACTIVE" &&
      (reward.stock === null || reward.stock > 0)
  );

  const myRewards = history.filter(
    (item) =>
      item.status === "PENDING" ||
      item.status === "APPROVED" ||
      item.status === "FULFILLED"
  );

  return (
    <div className="page">

      <div className="page-header">
        <div>
          <span>FAN REWARDS</span>

          <h1>Your Rewards</h1>

          <p>
            Your loyalty has value. Redeem what you've earned.
          </p>
        </div>
      </div>

      <div className="rewards-balance">

        <div>
          <span>AVAILABLE SPORTY POINTS</span>

          <strong>
            {loading
              ? "..."
              : formatPoints(data?.balance ?? 0)}
          </strong>

          <small>
            Keep earning points to unlock more rewards.
          </small>
        </div>

        <div className="balance-icon">
          <CircleDollarSign size={35} />
        </div>

      </div>

      {message && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "12px 16px",
            marginBottom: "20px",
            borderRadius: "10px",
          }}
        >
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "20px",
            borderRadius: "10px",
          }}
        >
          {error}
        </div>
      )}

      <div className="rewards-tabs">

        <button
          className={
            activeTab === "available"
              ? "active"
              : ""
          }
          onClick={() => {
            setActiveTab("available");
            setMessage("");
            setError("");
          }}
        >
          Available
        </button>

        <button
          className={
            activeTab === "mine"
              ? "active"
              : ""
          }
          onClick={() => {
            setActiveTab("mine");
            setMessage("");
            setError("");
          }}
        >
          My Rewards
        </button>

        <button
          className={
            activeTab === "history"
              ? "active"
              : ""
          }
          onClick={() => {
            setActiveTab("history");
            setMessage("");
            setError("");
          }}
        >
          History
        </button>

      </div>

      {loading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "50px",
          }}
        >
          <Loader2
            size={28}
            className="animate-spin"
          />
        </div>
      ) : activeTab === "available" ? (

        <div className="reward-grid">

          {availableRewards.length === 0 ? (
            <div>
              No rewards are currently available.
            </div>
          ) : (
            availableRewards.map((reward, index) => {

              const Icon = getRewardIcon(index);

              const isRedeeming =
                redeemingId === reward.id;

              const canAfford =
                (data?.balance ?? 0) >=
                reward.pointsCost;

              return (
                <div
                  className="reward-card"
                  key={reward.id}
                >

                  <div className="reward-image">
                    {reward.imageUrl ? (
                      <img
                        src={reward.imageUrl}
                        alt={reward.name}
                      />
                    ) : (
                      <Icon size={30} />
                    )}
                  </div>

                  <div className="reward-info">

                    <span>
                      {reward.name}
                    </span>

                    <strong>
                      {getRewardDescription(reward)}
                    </strong>

                    <small>
                      {formatPoints(
                        reward.pointsCost
                      )}{" "}
                      pts
                    </small>

                  </div>

                  <button
                    onClick={() =>
                      handleRedeem(reward.id)
                    }
                    disabled={
                      isRedeeming ||
                      !canAfford
                    }
                  >
                    {isRedeeming ? (
                      <>
                        <Loader2
                          size={15}
                          className="animate-spin"
                        />
                        Redeeming...
                      </>
                    ) : !canAfford ? (
                      "Not Enough Points"
                    ) : (
                      "Redeem"
                    )}
                  </button>

                </div>
              );
            })
          )}

        </div>

      ) : activeTab === "mine" ? (

        <div className="reward-grid">

          {myRewards.length === 0 ? (
            <div>
              You haven't redeemed any rewards yet.
            </div>
          ) : (
            myRewards.map((item) => (

              <div
                className="reward-card"
                key={item.id}
              >

                <div className="reward-image">
                  <Gift size={30} />
                </div>

                <div className="reward-info">

                  <span>
                    {item.rewardName}
                  </span>

                  <strong>
                    {formatPoints(
                      item.pointsSpent
                    )}{" "}
                    pts
                  </strong>

                  <small>
                    {item.referenceCode}
                  </small>

                </div>

                <div>
                  <Clock3 size={17} />

                  <small>
                    {item.status}
                  </small>
                </div>

              </div>

            ))
          )}

        </div>

      ) : (

        <div className="reward-grid">

          {history.length === 0 ? (
            <div>
              Your redemption history will
              appear here.
            </div>
          ) : (
            history.map((item) => (

              <div
                className="reward-card"
                key={item.id}
              >

                <div className="reward-image">
                  <Gift size={30} />
                </div>

                <div className="reward-info" style={{ flex: "1 1 120px", minWidth: 0 }}>

                  <span>
                    {item.rewardName}
                  </span>

                  <strong>
                     -{formatPoints(item.pointsSpent)} pts
                  </strong>

                  <small>
                    {formatDate(
                      item.createdAt
                    )}
                  </small>

                </div>

                 <div 
                 style={{
                   marginLeft: "auto",
                   display: "flex",
                   flexDirection: "column",
                   alignItems: "flex-end",
                   gap: 6,
                   flex: "0 1 300px",
                   minWidth: 150,
                   }}
                   >
                    <small
                       style={{
                          color:
                          item.status === "REJECTED"
                          ? "#c6283d"
                          : item.status === "FULFILLED"
                          ? "#079455"
                          : "#153a55",
                          fontWeight: 700,
                          textAlign: "right",
                        }}
                       >
                        {item.status}
                       </small>
                      </div>

                      {item.status === "REJECTED" && item.rejectionReason && (
                     <div
                        style={{
                           width: "100%",
                           boxSizing: "border-box",
                           padding: "7px 10px",
                           borderRadius: 8,
                           background: "#fff0f1",
                           border: "1px solid #f0c4ca",
                          }}
                         >
                        <strong
                           style={{
                              display: "block",
                              color: "#a61b2b",
                              fontSize: 11,
                              lineHeight: 1.3,
                              marginBottom: 3,
                           }}
                        >
                        Reason for rejection
                       </strong>

                       <p
                         style={{
                             color: "#702632",
                             fontSize: 12,
                             lineHeight: 1.35,
                             margin: 0,
                             whiteSpace: "pre-wrap",
                             overflowWrap: "anywhere",
                          }}
                        >
                         {item.rejectionReason}
                        </p>
                      </div>
                    )}

              </div>

            ))
          )}

        </div>

      )}

    </div>
  );
}