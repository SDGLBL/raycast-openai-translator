import {
  List,
  ActionPanel,
  Action,
  LaunchProps,
  Icon,
  getPreferenceValues,
  launchCommand,
  LaunchType,
} from "@raycast/api";
import { useState } from "react";
import { ContentView } from "./views/content";
import { useQuery } from "./hooks/useQuery";
import { LangDropdown } from "./views/lang-dropdown";
import { useHistory } from "./hooks/useHistory";
import capitalize from "capitalize";
import { TranslateMode } from "./providers/types";
import { ProvidersHook, useProviders } from "./hooks/useProvider";
import { createProvider } from "./providers";
import { Provider } from "./providers/base";

export default function getBase(
  props: LaunchProps,
  initialMode: TranslateMode = "translate",
  forceEnableAutoStart = false,
  forceEnableAutoLoadSelected = false,
  forceEnableAutoLoadClipboard = false,
) {
  let initialQuery: string | undefined = "";
  let ocrImage: string | undefined;
  if (props.launchContext) {
    initialMode = props.launchContext["mode"] as TranslateMode;
    initialQuery = props.launchContext["txt"];
    ocrImage = props.launchContext["img"];
    // if has key of autoStart, set it else set to false
    if (props.launchContext["autoStart"]) {
      forceEnableAutoStart = props.launchContext["autoStart"] as boolean;
    } else {
      if (props.launchContext["img"]) {
        forceEnableAutoStart = true; // ocr hack
      } else {
        forceEnableAutoStart = false;
      }
    }

    if (props.launchContext["loadSelected"]) {
      forceEnableAutoLoadSelected = props.launchContext["loadSelected"] as boolean;
    } else {
      forceEnableAutoLoadSelected = false;
    }

    if (props.launchContext["loadClipboard"]) {
      forceEnableAutoLoadClipboard = props.launchContext["loadClipboard"] as boolean;
    } else {
      forceEnableAutoLoadClipboard = false;
    }
  } else {
    initialQuery = props.fallbackText;
  }

  const [mode, setMode] = useState<TranslateMode>(initialMode);
  const [selectedId, setSelectedId] = useState<string>("");
  const query = useQuery({
    initialQuery,
    forceEnableAutoStart,
    forceEnableAutoLoadSelected,
    forceEnableAutoLoadClipboard,
    ocrImage,
  });
  const history = useHistory();

  const [isInit, setIsInit] = useState<boolean>(true);
  const [isEmpty, setIsEmpty] = useState<boolean>(true);

  const {
    provider: providerName,
    entrypoint,
    apikey,
    apiModel,
  } = getPreferenceValues<{
    entrypoint: string;
    apikey: string;
    apiModel: string;
    provider: string;
  }>();

  let provider: Provider | undefined;
  let providerHook: ProvidersHook | null = null;
  if (providerName == "custom") {
    providerHook = useProviders();
    if (!providerHook.isLoading) {
      provider = providerHook?.selected
        ? createProvider(providerHook.selected.type, providerHook.selected.props)
        : undefined;
      
      // 如果没有找到选中的 provider
      if (!provider) {
        // 如果没有数据，创建一个默认的 provider 用于开发模式
        if (!providerHook.data || providerHook.data.length === 0) {
          console.log("Creating default development provider");
          provider = createProvider("openai", {
            name: "Default OpenAI",
            entrypoint: "https://api.openai.com/v1/chat/completions",
            apikey: "dummy-key", // 开发模式用的占位符
            apiModel: "gpt-3.5-turbo",
          });
          
          // 不跳转到 provider 页面，在开发时使用默认 provider
        } else {
          // 如果有数据但没有选中项，则使用第一个 provider
          if (providerHook.data && providerHook.data.length > 0) {
            console.log("Using first provider from list");
            provider = createProvider(
              providerHook.data[0].type, 
              providerHook.data[0].props
            );
            
            // 自动设置选中项，避免下次再次出现该情况
            setTimeout(() => {
              providerHook.setSelected(providerHook.data[0]);
            }, 100);
          } else {
            console.log("No providers available, creating default");
            // 如果没有数据，创建一个默认的 provider
            provider = createProvider("openai", {
              name: "Default OpenAI",
              entrypoint: "https://api.openai.com/v1/chat/completions",
              apikey: "dummy-key", // 开发模式用的占位符
              apiModel: "gpt-3.5-turbo",
            });
          }
        }
      }
    }
  } else {
    provider = createProvider(providerName, {
      name: providerName,
      entrypoint,
      apikey,
      apiModel,
    });
  }
  if (provider) {
    return (
      <List
        searchText={query.text}
        isShowingDetail={!isInit && !isEmpty}
        filtering={false}
        isLoading={isInit}
        selectedItemId={selectedId}
        searchBarPlaceholder={`${capitalize(mode)}...`}
        onSearchTextChange={query.updateText}
        searchBarAccessory={
          <LangDropdown
            type={query.langType}
            selectedStandardLang={query.langType == "To" ? query.to : query.from}
            history={history}
            onLangChange={query.langType == "To" ? query.updateTo : query.updateFrom}
          />
        }
        throttle={false}
        navigationTitle={capitalize(mode)}
        actions={
          <ActionPanel>
            {query.text && (
              <Action title={capitalize(mode)} icon={Icon.Book} onAction={() => query.updateQuerying(true)} />
            )}
            <Action
              title={`Switch to Translate ${query.langType == "To" ? "From" : "To"}`}
              onAction={() => {
                query.updateLangType(query.langType == "To" ? "From" : "To");
              }}
            />
          </ActionPanel>
        }
      >
        <ContentView
          query={query}
          history={history}
          provider={provider}
          providerHook={providerHook}
          mode={mode}
          setMode={setMode}
          setSelectedId={setSelectedId}
          setIsInit={setIsInit}
          setIsEmpty={setIsEmpty}
        />
      </List>
    );
  }
}
