import EmojiPicker, {
  Emoji,
  EmojiStyle,
  Theme as EmojiTheme,
} from "emoji-picker-react";

import { ModelType } from "../store";

import BotIcon from "../icons/bot.svg";
import BlackBotIcon from "../icons/black-bot.svg";
import BotIconClaude from "../icons/bot-claude.svg";
import BotIconCohere from "../icons/bot-cohere.svg";
import BotIconDeepseek from "../icons/bot-deepseek.svg";
import BotIconGemini from "../icons/bot-gemini.svg";
import BotIconLlama from "../icons/bot-llama.svg";
import BotIconMistral from "../icons/bot-mistral.svg";
import BotIconQwen from "../icons/bot-qwen.svg";
import BotIconSparkdesk from "../icons/bot-sparkdesk.svg";
import BotIconGLM from "../icons/bot-glm.svg";
import BotIconMoonshot from "../icons/bot-moonshot.svg";

export function getEmojiUrl(unified: string, style: EmojiStyle) {
  // Whoever owns this Content Delivery Network (CDN), I am using your CDN to serve emojis
  // Old CDN broken, so I had to switch to this one
  // Author: https://github.com/H0llyW00dzZ
  return `https://fastly.jsdelivr.net/npm/emoji-datasource-apple/img/${style}/64/${unified}.png`;
}

export function AvatarPicker(props: {
  onEmojiClick: (emojiId: string) => void;
}) {
  return (
    <EmojiPicker
      width={"100%"}
      lazyLoadEmojis
      theme={EmojiTheme.AUTO}
      getEmojiUrl={getEmojiUrl}
      onEmojiClick={(e) => {
        props.onEmojiClick(e.unified);
      }}
    />
  );
}

export function Avatar(props: { model?: ModelType; avatar?: string }) {
  // if (props.model) {
  //   return (
  //     <div className="no-dark">
  //       {props.model?.startsWith("gpt-4") ? (
  //         <BlackBotIcon className="user-avatar" />
  //       ) : (
  //         <BotIcon className="user-avatar" />
  //       )}
  //     </div>
  //   );
  // }
  if (props.model) {
    let IconComponent;
    let model = props.model.toLowerCase();
    switch (true) {
      case model.includes("gpt-4"):
        IconComponent = BlackBotIcon;
        break;
      case model.includes("claude"):
        IconComponent = BotIconClaude;
        break;
      case model.includes("command"):
        IconComponent = BotIconCohere;
        break;
      case model.includes("deepseek"):
        IconComponent = BotIconDeepseek;
        break;
      case model.includes("gemini"):
        IconComponent = BotIconGemini;
        break;
      case model.includes("llama"):
        IconComponent = BotIconLlama;
        break;
      case model.includes("mistral"):
        IconComponent = BotIconMistral;
        break;
      case model.includes("qwen"):
        IconComponent = BotIconQwen;
        break;
      case model.includes("sparkdesk"):
        IconComponent = BotIconSparkdesk;
        break;
      case model.includes("glm"):
        IconComponent = BotIconGLM;
        break;
      case model.includes("moonshot"):
        IconComponent = BotIconMoonshot;
        break;
      default:
        IconComponent = BotIcon;
    }
    return (
      <div className="no-dark">
        {props.model?.startsWith("gpt-4") ? (
          <BlackBotIcon className="user-avatar" />
        ) : (
          <IconComponent />
        )}
      </div>
    );
  }

  return (
    <div className="user-avatar">
      {props.avatar && <EmojiAvatar avatar={props.avatar} />}
    </div>
  );
}

export function EmojiAvatar(props: { avatar: string; size?: number }) {
  return (
    <Emoji
      unified={props.avatar}
      size={props.size ?? 18}
      getEmojiUrl={getEmojiUrl}
    />
  );
}
