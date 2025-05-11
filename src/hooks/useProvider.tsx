import { LocalStorage, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProviderProps } from "../providers/types";

export interface Record {
  id: string;
  created_at: string;
  type: string;
  props: ProviderProps;
}

export interface ProvidersHook {
  data: Record[];
  isLoading: boolean;
  addOrUpdate: (arg: Record) => Promise<void>;
  remove: (arg: Record) => Promise<void>;
  selected: Record | undefined;
  setSelected: (record: Record) => void;
}

function encrypt(plaintext: string): string {
  const key = 42;
  let encrypted = "";
  for (let i = 0; i < plaintext.length; i++) {
    const charCode = plaintext.charCodeAt(i);
    const encryptedCharCode = charCode ^ key;
    encrypted += String.fromCharCode(encryptedCharCode);
  }
  return encrypted;
}

export function useProviders(): ProvidersHook {
  // 标记是否正在进行删除操作
  const isRemovingRef = useRef(false);
  const [data, setData] = useState<Record[]>([]);
  const countRef = useRef(data);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [selected, setSelected] = useState<Record>();
  
  // 调试用：监控状态变化
  useEffect(() => {
    console.log("Data state changed:", data);
    console.log("countRef state:", countRef.current);
    console.log("isRemoving state:", isRemovingRef.current);
  }, [data]);

  useEffect(() => {
    (async () => {
      try {
        console.log("======== Initializing useProviders hook ========");
        // 第一次加载时确保删除标记处于初始状态
        isRemovingRef.current = false;
        
        const stored = await LocalStorage.getItem<string>("providers");
        console.log("LocalStorage.getItem 'providers':", stored);
        const _selected = await LocalStorage.getItem<string>("selected");
        console.log("LocalStorage.getItem 'selected':", _selected);

        // 防止解析错误导致数据丢失
        let parsedData: Record[] = [];
        try {
          parsedData = stored ? JSON.parse(stored) : [];
          console.log("Parsed provider data:", parsedData);
        } catch (e) {
          console.error("Error parsing stored providers:", e);
        }

        // 处理 API key 解密
        const data = parsedData.map((item: Record) => {
          return {
            ...item,
            props: {
              ...item.props,
              apikey: item.props.apikey ? encrypt(item.props.apikey) : item.props.apikey,
            },
          };
        });
        
        const selected = data.find((item: Record) => item.id == _selected);
        console.log("Found selected provider:", selected);
        
        // 只有当有数据时才设置数据，避免清空已有数据
        if (data.length > 0) {
          console.log("Setting data from storage", data);
          countRef.current = data; // 同步设置 countRef 引用
          setData(data);
          setSelected(selected);
        } else {
          console.log("No data in storage");
        }
        console.log("======== Initialization complete ========");
      } catch (e) {
        console.error("Error loading providers:", e);
        // 出错时不重置数据，保持当前状态
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (data && data.length > 0) {
      console.log("new data", data);
      if (countRef.current != data) {
        countRef.current = data;
      }
      try {
        const dataToStore = data.map((item) => {
          return {
            ...item,
            props: {
              ...item.props,
              apikey: item.props.apikey ? encrypt(item.props.apikey) : item.props.apikey,
            },
          };
        });
        console.log("Saving data to LocalStorage", JSON.stringify(dataToStore));
        LocalStorage.setItem("providers", JSON.stringify(dataToStore));
      } catch (e) {
        console.error("Error saving providers:", e);
      }
    } else if (data && data.length === 0 && countRef.current && countRef.current.length > 0 && !isRemovingRef.current) {
      // 防止意外将数据重置为空数组
      // 但当有删除操作标记时，不应该恢复数据
      console.warn("Preventing data reset to empty array, restoring from reference");
      setTimeout(() => {
        setData(countRef.current); // 使用异步设置数据，避免死循环
      }, 0);
    } else if (data && data.length === 0) {
      console.log("Setting empty data array");
      // 只有当确实需要设置空数据时才设置
      LocalStorage.setItem("providers", JSON.stringify(data));
    }
  }, [data]);

  useEffect(() => {
    if (selected) {
      LocalStorage.setItem("selected", selected.id);
    }
  }, [selected]);

  const addOrUpdate = useCallback(
    async (record: Record) => {
      try {
        console.log("addOrUpdate", record);
        // 直接使用 countRef.current 防止获取旧数据
        const currentData = countRef.current || [];
        
        // 如果是首个 provider，设置为选中
        if (currentData.length === 0) {
          setSelected(record);
          
          // 立即保存选择
          try {
            await LocalStorage.setItem("selected", record.id);
          } catch (e) {
            console.error("Error saving selected:", e);
          }
        }

        let newData: Record[] = [];
        
        // 检查是更新还是新增
        if (currentData.find((item) => item.id === record.id)) {
          // 更新现有记录
          newData = currentData.map((item) => {
            if (item.id === record.id) {
              return record;
            }
            return item;
          });
          console.log("Updating existing record", newData);
          
          // 如果更新的是当前选中的记录，也更新 selected
          if (selected && selected.id === record.id) {
            setSelected(record);
          }
        } else {
          // 添加新记录
          console.log("Adding new record", record);
          newData = [record, ...currentData];
          
          // 如果没有选中的 provider，自动选中新添加的
          if (!selected) {
            setSelected(record);
            
            // 立即保存选择
            try {
              await LocalStorage.setItem("selected", record.id);
            } catch (e) {
              console.error("Error saving selected:", e);
            }
          }
        }
        
        // 同步更新 countRef，避免与 setData 异步更新的问题
        countRef.current = newData;
        setData(newData);
        
        // 立即将新数据保存到 LocalStorage
        try {
          const dataToStore = newData.map(item => ({
            ...item,
            props: {
              ...item.props,
              apikey: item.props.apikey ? encrypt(item.props.apikey) : item.props.apikey,
            },
          }));
          
          console.log("Directly saving data to LocalStorage", JSON.stringify(dataToStore));
          await LocalStorage.setItem("providers", JSON.stringify(dataToStore));
        } catch (e) {
          console.error("Error directly saving provider data:", e);
        }
      } catch (e) {
        console.error("Error in addOrUpdate:", e);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to save provider",
          message: String(e),
        });
      }
    },
    [setData, data, selected],
  );

  const remove = useCallback(
    async (record: Record) => {
      try {
        // 设置删除操作标记，防止数据保护机制将数据恢复
        isRemovingRef.current = true;
        console.log("Setting isRemovingRef to true for deletion operation");
        
        const currentData = countRef.current || [];
        if (currentData.length > 0) {
          console.log("Removing record", record);
          const toast = await showToast({
            title: "Removing record...",
            style: Toast.Style.Animated,
          });
          
          const newData: Record[] = currentData.filter((item) => item.id !== record.id);
          // 同步更新 countRef，防止异步导致的数据恢复
          countRef.current = newData;
          setData(newData);
          
          // 处理删除选中项的情况
          if (selected && selected.id === record.id) {
            if (newData.length > 0) {
              console.log("Selected provider removed, selecting first available");
              setSelected(newData[0]);
              
              // 立即更新选中项
              try {
                await LocalStorage.setItem("selected", newData[0].id);
              } catch (e) {
                console.error("Error updating selected after removal:", e);
              }
            } else {
              console.log("No providers left after removal");
              // 清空选中项
              try {
                await LocalStorage.removeItem("selected");
              } catch (e) {
                console.error("Error clearing selected after removal:", e);
              }
            }
          }
          
          // 立即将新数据保存到 LocalStorage
          try {
            console.log("Directly saving updated data to LocalStorage after removal");
            const dataToStore = newData.map(item => ({
              ...item,
              props: {
                ...item.props,
                apikey: item.props.apikey ? encrypt(item.props.apikey) : item.props.apikey,
              },
            }));
            
            await LocalStorage.setItem("providers", JSON.stringify(dataToStore));
          } catch (e) {
            console.error("Error saving data after removal:", e);
          }
          
          toast.title = "Provider removed!";
          toast.style = Toast.Style.Success;
        }
        
        // 设置定时器延迟重置删除标记，确保状态更新已完成
        setTimeout(() => {
          isRemovingRef.current = false;
          console.log("Reset isRemovingRef back to false after removal completed");
        }, 1000);
        
      } catch (e) {
        // 出错时也要重置标记
        isRemovingRef.current = false;
        console.error("Error in remove:", e);
        showToast({
          style: Toast.Style.Failure,
          title: "Failed to remove provider",
          message: String(e),
        });
      }
    },
    [setData, data, selected],
  );

  return useMemo(
    () => ({ data, isLoading, addOrUpdate, remove, selected, setSelected }),
    [data, isLoading, addOrUpdate, remove, selected, setSelected],
  );
}
