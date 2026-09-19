import { createCn } from "cn/config"

/* `cn` ships with Tailwind's default type scale. Our theme deliberately clears
   that scale and adds a few named sizes; teach the merger those names so it
   does not mistake `text-title`/`text-section` for colours and remove them
   when a text-colour utility follows. */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "micro",
            "fine",
            "label",
            "2xs",
            "section",
            "title",
            "gem-title",
            "card-title",
            "tooltip-heading",
          ],
        },
      ],
    },
  },
})
