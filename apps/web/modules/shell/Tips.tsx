import shuffle from "lodash/shuffle";
import posthog from "posthog-js";
import { useState, memo } from "react";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { localStorage } from "@calcom/lib/webstorage";
import { Card } from "@calcom/ui/components/card";

import { GatedFeatures } from "./stores/gatedFeaturesStore";
import { useGatedFeaturesStore } from "./stores/gatedFeaturesStore";

type Tip = {
  id: number;
  thumbnailUrl: string;
  mediaLink?: string;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  coverPhoto?: string;
  variant?: "SidebarCard" | "NewLaunchSidebarCard";
};

function Tips() {
  const { t } = useLocale();
  const openModal = useGatedFeaturesStore((state) => state.open);

  const tips: Tip[] = [
    {
      id: 18,
      thumbnailUrl: "https://artiocarbon.com/thumb.jpg",
      mediaLink: "https://artiocarbon.com",
      title: "Roles & Permissions",
      description: "Manage team access with roles & permissions",
      onClick: () => openModal(GatedFeatures.RolesAndPermissions),
    },
    {
      id: 17,
      thumbnailUrl: "https://artiocarbon.com/thumb.jpg",
      mediaLink: "https://artiocarbon.com",
      title: "Embed",
      description: "Embed your booking page on your website",
      href: "https://artiocarbon.com",
    },
    {
      id: 15,
      thumbnailUrl: "https://artiocarbon.com/thumb.jpg",
      mediaLink: "https://artiocarbon.com",
      title: "Instant Meetings",
      description: "Book meetings instantly with a link",
      href: "https://artiocarbon.com",
    },
    {
      id: 14,
      thumbnailUrl: "https://artiocarbon.com/thumb.jpg",
      mediaLink: "https://artiocarbon.com",
      title: "Custom Attributes",
      description: "Define roles and attributes for your teams",
      href: "https://artiocarbon.com",
    },
    {
      id: 11,
      thumbnailUrl: "https://artiocarbon.com/thumb.jpg",
      mediaLink: "https://artiocarbon.com",
      title: "Insights",
      description: "Get a better understanding of your business",
      href: "https://artiocarbon.com",
    },
    {
      id: 8,
      thumbnailUrl: "https://artiocarbon.com/thumb.jpg",
      mediaLink: "https://artiocarbon.com",
      title: "Automate Workflows",
      description: "Make time work for you and automate tasks",
      href: "https://artiocarbon.com",
    },
    {
      id: 2,
      thumbnailUrl: "https://artiocarbon.com/thumb.jpg",
      mediaLink: "https://artiocarbon.com",
      title: "How to set up Teams",
      description: "Learn how to use round-robin and collective events.",
      href: "https://artiocarbon.com",
    },
  ];

  const reversedTips = [...shuffle(tips).slice(0).reverse()];

  const [list, setList] = useState<Tip[]>(() => {
    if (typeof window === "undefined") {
      return reversedTips;
    }
    try {
      const removedTipsString = localStorage.getItem("removedTipsIds");
      if (removedTipsString !== null) {
        const removedTipsIds = removedTipsString.split(",").map((id) => parseInt(id, 10));
        const filteredTips = reversedTips.filter((tip) => removedTipsIds.indexOf(tip.id) === -1);
        return filteredTips;
      } else {
        return reversedTips;
      }
    } catch {
      return reversedTips;
    }
  });

  const handleRemoveItem = (id: number) => {
    setList((currentItems) => {
      const items = localStorage.getItem("removedTipsIds") || "";
      const itemToRemoveIndex = currentItems.findIndex((item) => item.id === id);

      if (itemToRemoveIndex === -1) return [...currentItems];

      localStorage.setItem(
        "removedTipsIds",
        `${currentItems[itemToRemoveIndex].id.toString()}${items.length > 0 ? `,${items}` : ""}`
      );
      currentItems.splice(itemToRemoveIndex, 1);
      return [...currentItems];
    });
  };

  const baseOriginalList = list.slice(0).reverse();
  return (
    <>
      <div
        className="hidden pb-4 pt-8 lg:grid"
        /* ref={animationRef} */
        style={{
          gridTemplateColumns: "1fr",
        }}>
        {list.map((tip) => {
          const isTopTip = baseOriginalList.indexOf(tip) === 0;
          return (
            <div
              className="relative"
              style={{
                gridRowStart: 1,
                gridColumnStart: 1,
              }}
              key={tip.id}>
              <div
                className="relative"
                style={{
                  transform: `scale(${1 - baseOriginalList.indexOf(tip) / 20})`,
                  top: -baseOriginalList.indexOf(tip) * 10,
                  opacity: `${1 - baseOriginalList.indexOf(tip) / 7}`,
                }}>
                <Card
                  variant={tip.variant ?? "SidebarCard"}
                  thumbnailUrl={tip.thumbnailUrl}
                  coverPhoto={tip.coverPhoto}
                  mediaLink={isTopTip ? tip.mediaLink : undefined}
                  mediaLinkOnClick={
                    isTopTip
                      ? () => {
                          posthog.capture("tip_video_clicked", tip);
                          if (tip.onClick) tip.onClick();
                        }
                      : undefined
                  }
                  title={t(tip.title)}
                  description={t(tip.description)}
                  learnMore={
                    isTopTip
                      ? {
                          href: tip.href,
                          text: t("learn_more"),
                          onClick: () => {
                            posthog.capture("tip_learn_more_clicked", tip);
                            if (tip.onClick) tip.onClick();
                          },
                        }
                      : undefined
                  }
                  actionButton={
                    isTopTip
                      ? {
                          onClick: () => {
                            posthog.capture("tip_dismiss_clicked", tip);
                            handleRemoveItem(tip.id);
                          },
                          child: t("dismiss"),
                        }
                      : undefined
                  }
                  containerProps={{
                    tabIndex: isTopTip ? undefined : -1,
                    "aria-hidden": isTopTip ? undefined : "true",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export default memo(Tips);
