// app/components/share.tsx

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiPath } from "../constant";
import { ChatSession } from "../store";
import { showToast } from "./ui-lib";
import Locale from "../locales";
import { Loading } from "./home";
import { ImagePreviewer } from "./exporter";
import styles from "./share.module.scss";

export function Share() {
  const { id } = useParams();
  const [session, setSession] = useState<ChatSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      setLoading(true);
      const cacheKey = `share-${id}`;
      const cachedSession = localStorage.getItem(cacheKey);
      if (cachedSession) {
        setSession(JSON.parse(cachedSession));
        setLoading(false);
        return;
      }

      fetch(`${ApiPath.Share}?id=${id}`)
        .then(async (res) => {
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || "Failed to fetch shared session");
          }
          return res.json();
        })
        .then((data) => {
          setSession(data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } catch (e) {
            console.error("Failed to cache shared session:", e);
          }
        })
        .catch((e) => {
          console.error("[Share Page] Fetch error:", e);
          showToast(Locale.Export.ShareError);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [id]);

  if (loading) {
    return <Loading />;
  }

  if (!session) {
    return (
      <div className={styles["share-error"]}>
        <h1>{Locale.Export.ShareNotFound}</h1>
        <p>{Locale.Export.ShareNotFoundDesc}</p>
      </div>
    );
  }

  return (
    <div className={styles["share-page"]}>
      <div className={styles["share-header"]}>
        <h1>{session.topic}</h1>
      </div>
      <div className={styles["share-content-wrapper"]}>
        <ImagePreviewer
          messages={session.messages}
          topic={session.topic}
          mask={session.mask}
          useDisplayName={false}
          notShowActions={true}
        />
      </div>
    </div>
  );
}
